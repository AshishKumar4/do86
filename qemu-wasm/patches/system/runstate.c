/*
 * QEMU main system emulation loop
 *
 * Copyright (c) 2003-2020 QEMU contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "qemu/osdep.h"
#include "audio/audio.h"
#include "block/block.h"
#include "block/export.h"
#include "chardev/char.h"
#include "crypto/cipher.h"
#include "crypto/init.h"
#include "exec/cpu-common.h"
#include "gdbstub/syscalls.h"
#include "hw/boards.h"
#include "hw/resettable.h"
#include "migration/misc.h"
#include "migration/postcopy-ram.h"
#include "monitor/monitor.h"
#include "net/net.h"
#include "net/vhost_net.h"
#include "qapi/error.h"
#include "qapi/qapi-commands-run-state.h"
#include "qapi/qapi-events-run-state.h"
#include "qemu/accel.h"
#include "qemu/error-report.h"
#include "system/cpus.h"
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include "accel/tcg/tcg-accel-ops.h"
#include "accel/tcg/tcg-accel-ops-icount.h"
/* Forward declarations for wasm_* bridge functions.
 * We can't include target headers here (system code, not per-target).
 * These are resolved at link time from the per-target library. */
void tlb_flush(CPUState *cpu);
void tlb_flush_page(CPUState *cpu, uint32_t addr);
void cpu_interrupt(CPUState *cpu, int mask);
#define CPU_INTERRUPT_HARD 0x0002
#if !defined(__ASYNCIFY__)
static void wasm_main_loop_callback(void);
/* js_pre_tick / js_post_tick: provided by JS runtime via EM_JS.
 * They're called before/after each main loop iteration. */
EM_JS(void, js_pre_tick, (void), { if (Module.preTick) Module.preTick(); });
EM_JS(void, js_post_tick, (void), { if (Module.postTick) Module.postTick(); });
#endif
#ifdef __EMSCRIPTEN__
uint32_t curr_cflags(CPUState *cpu);
#define DO86_CF_NOIRQ 0x00010000u
#endif
#include "exec/icount.h"
#include "tcg/startup.h"
#include "ui/console.h"
#include "ui/surface.h"
#endif
#include "qemu/job.h"
#include "qemu/log.h"
#include "qemu/module.h"
#include "qemu/sockets.h"
#include "qemu/timer.h"
#include "qemu/thread.h"
#include "qom/object.h"
#include "qom/object_interfaces.h"
#include "system/cpus.h"
#include "system/qtest.h"
#include "system/replay.h"
#include "system/reset.h"
#include "system/runstate.h"
#include "system/runstate-action.h"
#include "system/system.h"
#include "system/tpm.h"
#include "trace.h"

static NotifierList exit_notifiers =
    NOTIFIER_LIST_INITIALIZER(exit_notifiers);

static RunState current_run_state = RUN_STATE_PRELAUNCH;

/* We use RUN_STATE__MAX but any invalid value will do */
static RunState vmstop_requested = RUN_STATE__MAX;
static QemuMutex vmstop_lock;

typedef struct {
    RunState from;
    RunState to;
} RunStateTransition;

static const RunStateTransition runstate_transitions_def[] = {
    { RUN_STATE_PRELAUNCH, RUN_STATE_INMIGRATE },
    { RUN_STATE_PRELAUNCH, RUN_STATE_SUSPENDED },

    { RUN_STATE_DEBUG, RUN_STATE_RUNNING },
    { RUN_STATE_DEBUG, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_DEBUG, RUN_STATE_PRELAUNCH },

    { RUN_STATE_INMIGRATE, RUN_STATE_INTERNAL_ERROR },
    { RUN_STATE_INMIGRATE, RUN_STATE_IO_ERROR },
    { RUN_STATE_INMIGRATE, RUN_STATE_PAUSED },
    { RUN_STATE_INMIGRATE, RUN_STATE_RUNNING },
    { RUN_STATE_INMIGRATE, RUN_STATE_SHUTDOWN },
    { RUN_STATE_INMIGRATE, RUN_STATE_SUSPENDED },
    { RUN_STATE_INMIGRATE, RUN_STATE_WATCHDOG },
    { RUN_STATE_INMIGRATE, RUN_STATE_GUEST_PANICKED },
    { RUN_STATE_INMIGRATE, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_INMIGRATE, RUN_STATE_PRELAUNCH },
    { RUN_STATE_INMIGRATE, RUN_STATE_POSTMIGRATE },
    { RUN_STATE_INMIGRATE, RUN_STATE_COLO },

    { RUN_STATE_INTERNAL_ERROR, RUN_STATE_PAUSED },
    { RUN_STATE_INTERNAL_ERROR, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_INTERNAL_ERROR, RUN_STATE_PRELAUNCH },

    { RUN_STATE_IO_ERROR, RUN_STATE_RUNNING },
    { RUN_STATE_IO_ERROR, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_IO_ERROR, RUN_STATE_PRELAUNCH },

    { RUN_STATE_PAUSED, RUN_STATE_RUNNING },
    { RUN_STATE_PAUSED, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_PAUSED, RUN_STATE_POSTMIGRATE },
    { RUN_STATE_PAUSED, RUN_STATE_PRELAUNCH },
    { RUN_STATE_PAUSED, RUN_STATE_COLO},
    { RUN_STATE_PAUSED, RUN_STATE_SUSPENDED},

    { RUN_STATE_POSTMIGRATE, RUN_STATE_RUNNING },
    { RUN_STATE_POSTMIGRATE, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_POSTMIGRATE, RUN_STATE_PRELAUNCH },

    { RUN_STATE_PRELAUNCH, RUN_STATE_RUNNING },
    { RUN_STATE_PRELAUNCH, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_PRELAUNCH, RUN_STATE_INMIGRATE },

    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_RUNNING },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_PAUSED },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_POSTMIGRATE },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_PRELAUNCH },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_COLO },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_INTERNAL_ERROR },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_IO_ERROR },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_SHUTDOWN },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_SUSPENDED },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_WATCHDOG },
    { RUN_STATE_FINISH_MIGRATE, RUN_STATE_GUEST_PANICKED },

    { RUN_STATE_RESTORE_VM, RUN_STATE_RUNNING },
    { RUN_STATE_RESTORE_VM, RUN_STATE_PRELAUNCH },
    { RUN_STATE_RESTORE_VM, RUN_STATE_SUSPENDED },

    { RUN_STATE_COLO, RUN_STATE_RUNNING },
    { RUN_STATE_COLO, RUN_STATE_PRELAUNCH },
    { RUN_STATE_COLO, RUN_STATE_SHUTDOWN},

    { RUN_STATE_RUNNING, RUN_STATE_DEBUG },
    { RUN_STATE_RUNNING, RUN_STATE_INTERNAL_ERROR },
    { RUN_STATE_RUNNING, RUN_STATE_IO_ERROR },
    { RUN_STATE_RUNNING, RUN_STATE_PAUSED },
    { RUN_STATE_RUNNING, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_RUNNING, RUN_STATE_RESTORE_VM },
    { RUN_STATE_RUNNING, RUN_STATE_SAVE_VM },
    { RUN_STATE_RUNNING, RUN_STATE_SHUTDOWN },
    { RUN_STATE_RUNNING, RUN_STATE_WATCHDOG },
    { RUN_STATE_RUNNING, RUN_STATE_GUEST_PANICKED },
    { RUN_STATE_RUNNING, RUN_STATE_COLO},

    { RUN_STATE_SAVE_VM, RUN_STATE_RUNNING },
    { RUN_STATE_SAVE_VM, RUN_STATE_SUSPENDED },

    { RUN_STATE_SHUTDOWN, RUN_STATE_PAUSED },
    { RUN_STATE_SHUTDOWN, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_SHUTDOWN, RUN_STATE_PRELAUNCH },
    { RUN_STATE_SHUTDOWN, RUN_STATE_COLO },

    { RUN_STATE_DEBUG, RUN_STATE_SUSPENDED },
    { RUN_STATE_RUNNING, RUN_STATE_SUSPENDED },
    { RUN_STATE_SUSPENDED, RUN_STATE_RUNNING },
    { RUN_STATE_SUSPENDED, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_SUSPENDED, RUN_STATE_PRELAUNCH },
    { RUN_STATE_SUSPENDED, RUN_STATE_COLO},
    { RUN_STATE_SUSPENDED, RUN_STATE_PAUSED},
    { RUN_STATE_SUSPENDED, RUN_STATE_SAVE_VM },
    { RUN_STATE_SUSPENDED, RUN_STATE_RESTORE_VM },
    { RUN_STATE_SUSPENDED, RUN_STATE_SHUTDOWN },

    { RUN_STATE_WATCHDOG, RUN_STATE_RUNNING },
    { RUN_STATE_WATCHDOG, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_WATCHDOG, RUN_STATE_PRELAUNCH },
    { RUN_STATE_WATCHDOG, RUN_STATE_COLO},

    { RUN_STATE_GUEST_PANICKED, RUN_STATE_RUNNING },
    { RUN_STATE_GUEST_PANICKED, RUN_STATE_FINISH_MIGRATE },
    { RUN_STATE_GUEST_PANICKED, RUN_STATE_PRELAUNCH },

    { RUN_STATE__MAX, RUN_STATE__MAX },
};

static const RunStateTransition replay_play_runstate_transitions_def[] = {
    { RUN_STATE_SHUTDOWN, RUN_STATE_RUNNING},

    { RUN_STATE__MAX, RUN_STATE__MAX },
};

static bool runstate_valid_transitions[RUN_STATE__MAX][RUN_STATE__MAX];

bool runstate_check(RunState state)
{
    return current_run_state == state;
}

static void transitions_set_valid(const RunStateTransition *rst)
{
    const RunStateTransition *p;

    for (p = rst; p->from != RUN_STATE__MAX; p++) {
        runstate_valid_transitions[p->from][p->to] = true;
    }
}

void runstate_replay_enable(void)
{
    assert(replay_mode != REPLAY_MODE_NONE);

    if (replay_mode == REPLAY_MODE_PLAY) {
        /*
         * When reverse-debugging, it is possible to move state from
         * shutdown to running.
         */
        transitions_set_valid(&replay_play_runstate_transitions_def[0]);
    }
}

static void runstate_init(void)
{
    memset(&runstate_valid_transitions, 0, sizeof(runstate_valid_transitions));

    transitions_set_valid(&runstate_transitions_def[0]);

    qemu_mutex_init(&vmstop_lock);
}

/* This function will abort() on invalid state transitions */
void runstate_set(RunState new_state)
{
    assert(new_state < RUN_STATE__MAX);

    trace_runstate_set(current_run_state, RunState_str(current_run_state),
                       new_state, RunState_str(new_state));

    if (current_run_state == new_state) {
        return;
    }

    if (!runstate_valid_transitions[current_run_state][new_state]) {
        error_report("invalid runstate transition: '%s' -> '%s'",
                     RunState_str(current_run_state),
                     RunState_str(new_state));
        abort();
    }

    current_run_state = new_state;
}

RunState runstate_get(void)
{
    return current_run_state;
}

bool runstate_is_running(void)
{
    return runstate_check(RUN_STATE_RUNNING);
}

bool runstate_needs_reset(void)
{
    return runstate_check(RUN_STATE_INTERNAL_ERROR) ||
        runstate_check(RUN_STATE_SHUTDOWN);
}

StatusInfo *qmp_query_status(Error **errp)
{
    StatusInfo *info = g_malloc0(sizeof(*info));

    info->running = runstate_is_running();
    info->status = current_run_state;

    return info;
}

bool qemu_vmstop_requested(RunState *r)
{
    qemu_mutex_lock(&vmstop_lock);
    *r = vmstop_requested;
    vmstop_requested = RUN_STATE__MAX;
    qemu_mutex_unlock(&vmstop_lock);
    return *r < RUN_STATE__MAX;
}

void qemu_system_vmstop_request_prepare(void)
{
    qemu_mutex_lock(&vmstop_lock);
}

void qemu_system_vmstop_request(RunState state)
{
    vmstop_requested = state;
    qemu_mutex_unlock(&vmstop_lock);
    qemu_notify_event();
}
struct VMChangeStateEntry {
    VMChangeStateHandler *cb;
    VMChangeStateHandler *prepare_cb;
    VMChangeStateHandlerWithRet *cb_ret;
    void *opaque;
    QTAILQ_ENTRY(VMChangeStateEntry) entries;
    int priority;
};

static QTAILQ_HEAD(, VMChangeStateEntry) vm_change_state_head =
    QTAILQ_HEAD_INITIALIZER(vm_change_state_head);

VMChangeStateEntry *qemu_add_vm_change_state_handler_prio(
        VMChangeStateHandler *cb, void *opaque, int priority)
{
    return qemu_add_vm_change_state_handler_prio_full(cb, NULL, NULL,
                                                      opaque, priority);
}

VMChangeStateEntry *
qemu_add_vm_change_state_handler_prio_full(VMChangeStateHandler *cb,
                                           VMChangeStateHandler *prepare_cb,
                                           VMChangeStateHandlerWithRet *cb_ret,
                                           void *opaque, int priority)
{
    VMChangeStateEntry *e;
    VMChangeStateEntry *other;

    e = g_malloc0(sizeof(*e));
    e->cb = cb;
    e->prepare_cb = prepare_cb;
    e->cb_ret = cb_ret;
    e->opaque = opaque;
    e->priority = priority;

    /* Keep list sorted in ascending priority order */
    QTAILQ_FOREACH(other, &vm_change_state_head, entries) {
        if (priority < other->priority) {
            QTAILQ_INSERT_BEFORE(other, e, entries);
            return e;
        }
    }

    QTAILQ_INSERT_TAIL(&vm_change_state_head, e, entries);
    return e;
}

VMChangeStateEntry *qemu_add_vm_change_state_handler(VMChangeStateHandler *cb,
                                                     void *opaque)
{
    return qemu_add_vm_change_state_handler_prio(cb, opaque, 0);
}

void qemu_del_vm_change_state_handler(VMChangeStateEntry *e)
{
    QTAILQ_REMOVE(&vm_change_state_head, e, entries);
    g_free(e);
}

int vm_state_notify(bool running, RunState state)
{
    VMChangeStateEntry *e, *next;
    int ret = 0;

    trace_vm_state_notify(running, state, RunState_str(state));

    if (running) {
        QTAILQ_FOREACH_SAFE(e, &vm_change_state_head, entries, next) {
            if (e->prepare_cb) {
                e->prepare_cb(e->opaque, running, state);
            }
        }

        QTAILQ_FOREACH_SAFE(e, &vm_change_state_head, entries, next) {
            if (e->cb) {
                e->cb(e->opaque, running, state);
            } else if (e->cb_ret) {
                /*
                 * Here ignore the return value of cb_ret because
                 * we only care about the stopping the device during
                 * the VM live migration to indicate whether the
                 * connection between qemu and backend is normal.
                 */
                e->cb_ret(e->opaque, running, state);
            }
        }
    } else {
        QTAILQ_FOREACH_REVERSE_SAFE(e, &vm_change_state_head, entries, next) {
            if (e->prepare_cb) {
                e->prepare_cb(e->opaque, running, state);
            }
        }

        QTAILQ_FOREACH_REVERSE_SAFE(e, &vm_change_state_head, entries, next) {
            if (e->cb) {
                e->cb(e->opaque, running, state);
            } else if (e->cb_ret) {
                /*
                 * We should execute all registered callbacks even if
                 * one of them returns failure, otherwise, some cleanup
                 * work of the device will be skipped.
                 */
                ret |= e->cb_ret(e->opaque, running, state);
            }
        }
    }
    return ret;
}

static ShutdownCause reset_requested;
static ShutdownCause shutdown_requested;
static int shutdown_exit_code = EXIT_SUCCESS;
static int shutdown_signal;
static bool force_shutdown;
static pid_t shutdown_pid;
static int powerdown_requested;
static int debug_requested;
static int suspend_requested;
static WakeupReason wakeup_reason;
static NotifierList powerdown_notifiers =
    NOTIFIER_LIST_INITIALIZER(powerdown_notifiers);
static NotifierList suspend_notifiers =
    NOTIFIER_LIST_INITIALIZER(suspend_notifiers);
static NotifierList wakeup_notifiers =
    NOTIFIER_LIST_INITIALIZER(wakeup_notifiers);
static NotifierList shutdown_notifiers =
    NOTIFIER_LIST_INITIALIZER(shutdown_notifiers);
static uint32_t wakeup_reason_mask = ~(1 << QEMU_WAKEUP_REASON_NONE);

ShutdownCause qemu_shutdown_requested_get(void)
{
    return shutdown_requested;
}

bool qemu_force_shutdown_requested(void)
{
    return force_shutdown;
}

ShutdownCause qemu_reset_requested_get(void)
{
    return reset_requested;
}

static int qemu_shutdown_requested(void)
{
    return qatomic_xchg(&shutdown_requested, SHUTDOWN_CAUSE_NONE);
}

static void qemu_kill_report(void)
{
    if (!qtest_driver() && shutdown_signal) {
        if (shutdown_pid == 0) {
            /* This happens for eg ^C at the terminal, so it's worth
             * avoiding printing an odd message in that case.
             */
            error_report("terminating on signal %d", shutdown_signal);
        } else {
            char *shutdown_cmd = qemu_get_pid_name(shutdown_pid);

            error_report("terminating on signal %d from pid " FMT_pid " (%s)",
                         shutdown_signal, shutdown_pid,
                         shutdown_cmd ? shutdown_cmd : "<unknown process>");
            g_free(shutdown_cmd);
        }
        shutdown_signal = 0;
    }
}

static ShutdownCause qemu_reset_requested(void)
{
    ShutdownCause r = reset_requested;

    if (r && replay_checkpoint(CHECKPOINT_RESET_REQUESTED)) {
        reset_requested = SHUTDOWN_CAUSE_NONE;
        return r;
    }
    return SHUTDOWN_CAUSE_NONE;
}

static int qemu_suspend_requested(void)
{
    int r = suspend_requested;
    if (r && replay_checkpoint(CHECKPOINT_SUSPEND_REQUESTED)) {
        suspend_requested = 0;
        return r;
    }
    return false;
}

static WakeupReason qemu_wakeup_requested(void)
{
    return wakeup_reason;
}

static int qemu_powerdown_requested(void)
{
    int r = powerdown_requested;
    powerdown_requested = 0;
    return r;
}

static int qemu_debug_requested(void)
{
    int r = debug_requested;
    debug_requested = 0;
    return r;
}

/*
 * Reset the VM. Issue an event unless @reason is SHUTDOWN_CAUSE_NONE.
 */
void qemu_system_reset(ShutdownCause reason)
{
    MachineClass *mc;
    ResetType type;

    mc = current_machine ? MACHINE_GET_CLASS(current_machine) : NULL;

    cpu_synchronize_all_states();

    switch (reason) {
    case SHUTDOWN_CAUSE_SNAPSHOT_LOAD:
        type = RESET_TYPE_SNAPSHOT_LOAD;
        break;
    default:
        type = RESET_TYPE_COLD;
    }
    if (mc && mc->reset) {
        mc->reset(current_machine, type);
    } else {
        qemu_devices_reset(type);
    }
    switch (reason) {
    case SHUTDOWN_CAUSE_NONE:
    case SHUTDOWN_CAUSE_SUBSYSTEM_RESET:
    case SHUTDOWN_CAUSE_SNAPSHOT_LOAD:
        break;
    default:
        qapi_event_send_reset(shutdown_caused_by_guest(reason), reason);
    }

    /*
     * Some boards use the machine reset callback to point CPUs to the firmware
     * entry point.  Assume that this is not the case for boards that support
     * non-resettable CPUs (currently used only for confidential guests), in
     * which case cpu_synchronize_all_post_init() is enough because
     * it does _more_  than cpu_synchronize_all_post_reset().
     */
    if (cpus_are_resettable()) {
        cpu_synchronize_all_post_reset();
    } else {
        assert(runstate_check(RUN_STATE_PRELAUNCH));
    }

    vm_set_suspended(false);
}

/*
 * Wake the VM after suspend.
 */
static void qemu_system_wakeup(void)
{
    MachineClass *mc;

    mc = current_machine ? MACHINE_GET_CLASS(current_machine) : NULL;

    if (mc && mc->wakeup) {
        mc->wakeup(current_machine);
    }
}

static char *tdx_parse_panic_message(char *message)
{
    bool printable = false;
    char *buf = NULL;
    int len = 0, i;

    /*
     * Although message is defined as a json string, we shouldn't
     * unconditionally treat it as is because the guest generated it and
     * it's not necessarily trustable.
     */
    if (message) {
        /* The caller guarantees the NULL-terminated string. */
        len = strlen(message);

        printable = len > 0;
        for (i = 0; i < len; i++) {
            if (!(0x20 <= message[i] && message[i] <= 0x7e)) {
                printable = false;
                break;
            }
        }
    }

    if (len == 0) {
        buf = g_malloc(1);
        buf[0] = '\0';
    } else {
        if (!printable) {
            /* 3 = length of "%02x " */
            buf = g_malloc(len * 3);
            for (i = 0; i < len; i++) {
                if (message[i] == '\0') {
                    break;
                } else {
                    sprintf(buf + 3 * i, "%02x ", message[i]);
                }
            }
            if (i > 0) {
                /* replace the last ' '(space) to NULL */
                buf[i * 3 - 1] = '\0';
            } else {
                buf[0] = '\0';
            }
        } else {
            buf = g_strdup(message);
        }
    }

    return buf;
}

void qemu_system_guest_panicked(GuestPanicInformation *info)
{
    qemu_log_mask(LOG_GUEST_ERROR, "Guest crashed");

    if (current_cpu) {
        current_cpu->crash_occurred = true;
    }
    /*
     * TODO:  Currently the available panic actions are: none, pause, and
     * shutdown, but in principle debug and reset could be supported as well.
     * Investigate any potential use cases for the unimplemented actions.
     */
    if (panic_action == PANIC_ACTION_PAUSE
        || (panic_action == PANIC_ACTION_SHUTDOWN && shutdown_action == SHUTDOWN_ACTION_PAUSE)) {
        qapi_event_send_guest_panicked(GUEST_PANIC_ACTION_PAUSE, info);
        vm_stop(RUN_STATE_GUEST_PANICKED);
    } else if (panic_action == PANIC_ACTION_SHUTDOWN ||
               panic_action == PANIC_ACTION_EXIT_FAILURE) {
        qapi_event_send_guest_panicked(GUEST_PANIC_ACTION_POWEROFF, info);
        vm_stop(RUN_STATE_GUEST_PANICKED);
        qemu_system_shutdown_request(SHUTDOWN_CAUSE_GUEST_PANIC);
    } else {
        qapi_event_send_guest_panicked(GUEST_PANIC_ACTION_RUN, info);
    }

    if (info) {
        if (info->type == GUEST_PANIC_INFORMATION_TYPE_HYPER_V) {
            qemu_log_mask(LOG_GUEST_ERROR, "\nHV crash parameters: (%#"PRIx64
                          " %#"PRIx64" %#"PRIx64" %#"PRIx64" %#"PRIx64")\n",
                          info->u.hyper_v.arg1,
                          info->u.hyper_v.arg2,
                          info->u.hyper_v.arg3,
                          info->u.hyper_v.arg4,
                          info->u.hyper_v.arg5);
        } else if (info->type == GUEST_PANIC_INFORMATION_TYPE_S390) {
            qemu_log_mask(LOG_GUEST_ERROR, " on cpu %d: %s\n"
                          "PSW: 0x%016" PRIx64 " 0x%016" PRIx64"\n",
                          info->u.s390.core,
                          S390CrashReason_str(info->u.s390.reason),
                          info->u.s390.psw_mask,
                          info->u.s390.psw_addr);
        } else if (info->type == GUEST_PANIC_INFORMATION_TYPE_TDX) {
            char *message = tdx_parse_panic_message(info->u.tdx.message);
            qemu_log_mask(LOG_GUEST_ERROR,
                          "\nTDX guest reports fatal error."
                          " error code: 0x%" PRIx32 " error message:\"%s\"\n",
                          info->u.tdx.error_code, message);
            g_free(message);
            if (info->u.tdx.gpa != -1ull) {
                qemu_log_mask(LOG_GUEST_ERROR, "Additional error information "
                              "can be found at gpa page: 0x%" PRIx64 "\n",
                              info->u.tdx.gpa);
            }
        }

        qapi_free_GuestPanicInformation(info);
    }
}

void qemu_system_guest_crashloaded(GuestPanicInformation *info)
{
    qemu_log_mask(LOG_GUEST_ERROR, "Guest crash loaded");
    qapi_event_send_guest_crashloaded(GUEST_PANIC_ACTION_RUN, info);
    qapi_free_GuestPanicInformation(info);
}

void qemu_system_guest_pvshutdown(void)
{
    qapi_event_send_guest_pvshutdown();
    qemu_system_shutdown_request(SHUTDOWN_CAUSE_GUEST_SHUTDOWN);
}

void qemu_system_reset_request(ShutdownCause reason)
{
    if (reboot_action == REBOOT_ACTION_SHUTDOWN &&
        reason != SHUTDOWN_CAUSE_SUBSYSTEM_RESET) {
        shutdown_requested = reason;
    } else if (!cpus_are_resettable()) {
        error_report("cpus are not resettable, terminating");
        shutdown_requested = reason;
    } else {
        reset_requested = reason;
    }
    cpu_stop_current();
    qemu_notify_event();
}

static void qemu_system_suspend(void)
{
    pause_all_vcpus();
    notifier_list_notify(&suspend_notifiers, NULL);
    runstate_set(RUN_STATE_SUSPENDED);
    qapi_event_send_suspend();
}

void qemu_system_suspend_request(void)
{
    if (runstate_check(RUN_STATE_SUSPENDED)) {
        return;
    }
    suspend_requested = 1;
    cpu_stop_current();
    qemu_notify_event();
}

void qemu_register_suspend_notifier(Notifier *notifier)
{
    notifier_list_add(&suspend_notifiers, notifier);
}

void qemu_system_wakeup_request(WakeupReason reason, Error **errp)
{
    trace_system_wakeup_request(reason);

    if (!runstate_check(RUN_STATE_SUSPENDED)) {
        error_setg(errp,
                   "Unable to wake up: guest is not in suspended state");
        return;
    }
    if (!(wakeup_reason_mask & (1 << reason))) {
        return;
    }
    runstate_set(RUN_STATE_RUNNING);
    wakeup_reason = reason;
    qemu_notify_event();
}

void qemu_system_wakeup_enable(WakeupReason reason, bool enabled)
{
    if (enabled) {
        wakeup_reason_mask |= (1 << reason);
    } else {
        wakeup_reason_mask &= ~(1 << reason);
    }
}

void qemu_register_wakeup_notifier(Notifier *notifier)
{
    notifier_list_add(&wakeup_notifiers, notifier);
}

static bool wakeup_suspend_enabled;

void qemu_register_wakeup_support(void)
{
    wakeup_suspend_enabled = true;
}

bool qemu_wakeup_suspend_enabled(void)
{
    return wakeup_suspend_enabled;
}

void qemu_system_killed(int signal, pid_t pid)
{
    shutdown_signal = signal;
    shutdown_pid = pid;
    shutdown_action = SHUTDOWN_ACTION_POWEROFF;

    /* Cannot call qemu_system_shutdown_request directly because
     * we are in a signal handler.
     */
    shutdown_requested = SHUTDOWN_CAUSE_HOST_SIGNAL;
    force_shutdown = true;
    qemu_notify_event();
}

void qemu_system_shutdown_request_with_code(ShutdownCause reason,
                                            int exit_code)
{
    shutdown_exit_code = exit_code;
    qemu_system_shutdown_request(reason);
}

void qemu_system_shutdown_request(ShutdownCause reason)
{
    trace_qemu_system_shutdown_request(reason);
    replay_shutdown_request(reason);
    shutdown_requested = reason;
    if (reason == SHUTDOWN_CAUSE_HOST_QMP_QUIT) {
        force_shutdown = true;
    }
    qemu_notify_event();
}

static void qemu_system_powerdown(void)
{
    qapi_event_send_powerdown();
    notifier_list_notify(&powerdown_notifiers, NULL);
}

static void qemu_system_shutdown(ShutdownCause cause)
{
    qapi_event_send_shutdown(shutdown_caused_by_guest(cause), cause);
    notifier_list_notify(&shutdown_notifiers, &cause);
}

void qemu_system_powerdown_request(void)
{
    trace_qemu_system_powerdown_request();
    powerdown_requested = 1;
    qemu_notify_event();
}

void qemu_register_powerdown_notifier(Notifier *notifier)
{
    notifier_list_add(&powerdown_notifiers, notifier);
}

void qemu_register_shutdown_notifier(Notifier *notifier)
{
    notifier_list_add(&shutdown_notifiers, notifier);
}

void qemu_system_debug_request(void)
{
    debug_requested = 1;
    qemu_notify_event();
}

static bool main_loop_should_exit(int *status)
{
    RunState r;
    ShutdownCause request;

    if (qemu_debug_requested()) {
        vm_stop(RUN_STATE_DEBUG);
    }
    if (qemu_suspend_requested()) {
        qemu_system_suspend();
    }
    request = qemu_shutdown_requested();
    if (request) {
        qemu_kill_report();
        qemu_system_shutdown(request);
        if (shutdown_action == SHUTDOWN_ACTION_PAUSE) {
            vm_stop(RUN_STATE_SHUTDOWN);
        } else {
            if (shutdown_exit_code != EXIT_SUCCESS) {
                *status = shutdown_exit_code;
            } else if (request == SHUTDOWN_CAUSE_GUEST_PANIC &&
                panic_action == PANIC_ACTION_EXIT_FAILURE) {
                *status = EXIT_FAILURE;
            }
#ifdef __EMSCRIPTEN__
            fprintf(stderr, "[RUNSTATE] shutdown request=%d status=%d\n", request, *status);
#endif
            return true;
        }
    }
    request = qemu_reset_requested();
    if (request) {
        pause_all_vcpus();
        qemu_system_reset(request);
        resume_all_vcpus();
        /*
         * runstate can change in pause_all_vcpus()
         * as iothread mutex is unlocked
         */
        if (!runstate_check(RUN_STATE_RUNNING) &&
                !runstate_check(RUN_STATE_INMIGRATE) &&
                !runstate_check(RUN_STATE_FINISH_MIGRATE)) {
            runstate_set(RUN_STATE_PRELAUNCH);
        }
    }
    if (qemu_wakeup_requested()) {
        pause_all_vcpus();
        qemu_system_wakeup();
        notifier_list_notify(&wakeup_notifiers, &wakeup_reason);
        wakeup_reason = QEMU_WAKEUP_REASON_NONE;
        resume_all_vcpus();
        qapi_event_send_wakeup();
    }
    if (qemu_powerdown_requested()) {
        qemu_system_powerdown();
    }
    if (qemu_vmstop_requested(&r)) {
        vm_stop(r);
    }
    return false;
}

#ifdef __EMSCRIPTEN__
static unsigned do86_debug_exec_count;
static void do86_drive_vcpus(void)
{
    static bool tcg_thread_setup_done;
    CPUState *cpu = first_cpu;
    int64_t cpu_budget = icount_enabled() ? icount_percpu_budget(1) : 0;

    if (!tcg_thread_setup_done) {
        tcg_thread_setup_done = true;
        CPU_FOREACH(cpu) {
            cpu->neg.can_do_io = true;
        }
        cpu = first_cpu;
    }

    if (!cpu) {
        return;
    }

    {
        static unsigned int drv_count;
        drv_count++;
        if (drv_count <= 10) {
            fprintf(stdout, "[DRV] #%u cpu=%p wle=%d exit=%d can=%d stop=%d halt=%d rs=%d\n",
                    drv_count, cpu, cpu_work_list_empty(cpu), cpu->exit_request, cpu_can_run(cpu), cpu->stop, cpu->halted, runstate_get());
            fflush(stdout);
        }
    }
    while (cpu && cpu_work_list_empty(cpu) && !cpu->exit_request) {
        current_cpu = cpu;
        qemu_clock_enable(QEMU_CLOCK_VIRTUAL,
                          (cpu->singlestep_enabled & SSTEP_NOTIMER) == 0);

        if (cpu_can_run(cpu)) {
            int r;
            qatomic_set(&cpu->exit_request, 0);
            cpu->cflags_next_tb = curr_cflags(cpu);
            bql_unlock();
            if (icount_enabled()) {
                icount_prepare_for_run(cpu, cpu_budget);
            }
            r = tcg_cpu_exec(cpu);
            if (icount_enabled()) {
                icount_process_data(cpu);
            }
            bql_lock();
            do86_debug_exec_count++;
            if (do86_debug_exec_count <= 10 || do86_debug_exec_count % 5000 == 0) {
                fprintf(stdout, "[EXEC] count=%u ret=%d pcpu=%p halted=%d exit_request=%d irq=%x\n",
                        do86_debug_exec_count, r, cpu, cpu->halted, cpu->exit_request, cpu->interrupt_request);
                fflush(stdout);
            }
            if (r == EXCP_DEBUG) {
                cpu_handle_guest_debug(cpu);
                break;
            } else if (r == EXCP_ATOMIC) {
                bql_unlock();
                cpu_exec_step_atomic(cpu);
                bql_lock();
                break;
            }
        } else if (cpu->stop) {
            break;
        }

        cpu = CPU_NEXT(cpu);
    }

    if (!cpu) {
        cpu = first_cpu;
    }

    if (cpu && cpu->exit_request) {
        qatomic_set_mb(&cpu->exit_request, 0);
    }

    if (icount_enabled() && all_cpu_threads_idle()) {
        qemu_notify_event();
    }

    CPU_FOREACH(cpu) {
        qemu_wait_io_event_common(cpu);
    }
}

EMSCRIPTEN_KEEPALIVE
int do86_qemu_step(void)
{
    int status = EXIT_SUCCESS;
    bool had_bql = bql_locked();
    static unsigned do86_step_count;

    if (!had_bql) {
        replay_mutex_lock();
        bql_lock();
    }
    if (main_loop_should_exit(&status)) {
#ifdef __EMSCRIPTEN__
        fprintf(stdout, "[STEP] should_exit status=%d\n", status); fflush(stdout);
#endif
        if (!had_bql) {
            bql_unlock();
            replay_mutex_unlock();
        }
        return status ? status : 1;
    }

    do86_step_count++;
#ifdef __EMSCRIPTEN__
    if (do86_step_count <= 10 || do86_step_count % 250 == 0) {
        fprintf(stdout, "[STEP] n=%u runstate=%d first_cpu=%p stopped=%d stop=%d can_run=%d\n",
                do86_step_count,
                runstate_get(),
                first_cpu,
                first_cpu ? first_cpu->stopped : -1,
                first_cpu ? first_cpu->stop : -1,
                first_cpu ? cpu_can_run(first_cpu) : -1);
        fflush(stdout);
    }
#endif

    do86_drive_vcpus();
    main_loop_wait(false);
    if (!had_bql) {
        bql_unlock();
        replay_mutex_unlock();
    }
    return 0;
}
#endif

int qemu_main_loop(void)
{
    int status = EXIT_SUCCESS;

#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[ML-LOOP] enter runstate=%d shutdown_requested=%d\n", runstate_get(), shutdown_requested); fflush(stdout);
#endif

#ifdef __EMSCRIPTEN__
    /* Emscripten: return immediately. Execution is driven by:
     *   - wasm_step(): runs N TBs of guest code (no event processing)
     *   - wasm_pump_events(): calls main_loop_wait (timer/AIO processing)
     * Both are called from JS via separate setTimeout chains. */
    fprintf(stdout, "[ML-LOOP] Emscripten: returning to JS, first_cpu=%p\n",
            first_cpu); fflush(stdout);
    {
        /* Drain CPU work list before returning */
        CPUState *cpu;
        CPU_FOREACH(cpu) {
            while (!cpu_work_list_empty(cpu)) {
                process_queued_cpu_work(cpu);
            }
        }
    }
    return 0;
#else
    while (!main_loop_should_exit(&status)) {
        main_loop_wait(false);
    }
    return status;
#endif
}

void qemu_add_exit_notifier(Notifier *notify)
{
    notifier_list_add(&exit_notifiers, notify);
}

void qemu_remove_exit_notifier(Notifier *notify)
{
    notifier_remove(notify);
}

static void qemu_run_exit_notifiers(void)
{
    BQL_LOCK_GUARD();
    notifier_list_notify(&exit_notifiers, NULL);
}

void qemu_init_subsystems(void)
{
    Error *err = NULL;
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] enter\n"); fflush(stdout);
#endif

    os_set_line_buffering();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] line buffering\n"); fflush(stdout);
#endif

    module_call_init(MODULE_INIT_TRACE);
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] trace init\n"); fflush(stdout);
#endif

    qemu_init_cpu_list();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] cpu list\n"); fflush(stdout);
#endif
    qemu_init_cpu_loop();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] cpu loop\n"); fflush(stdout);
#endif
    bql_lock();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] bql lock\n"); fflush(stdout);
#endif

    atexit(qemu_run_exit_notifiers);
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] atexit\n"); fflush(stdout);
#endif

    module_call_init(MODULE_INIT_QOM);
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] qom init\n"); fflush(stdout);
#endif
    module_call_init(MODULE_INIT_MIGRATION);
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] migration init\n"); fflush(stdout);
#endif

    runstate_init();
    precopy_infrastructure_init();
    postcopy_infrastructure_init();
    monitor_init_globals();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] core init done\n"); fflush(stdout);
#endif

    if (qcrypto_init(&err) < 0) {
        error_reportf_err(err, "cannot initialize crypto: ");
        exit(1);
    }
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] crypto init\n"); fflush(stdout);
#endif

    os_setup_early_signal_handling();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] signal handling\n"); fflush(stdout);
#endif

    bdrv_init_with_whitelist();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] block init\n"); fflush(stdout);
#endif
    socket_init();
#ifdef __EMSCRIPTEN__
    fprintf(stdout, "[SUBSYS] socket init\n"); fflush(stdout);
#endif
}


void qemu_cleanup(int status)
{
    gdb_exit(status);

    /*
     * cleaning up the migration object cancels any existing migration
     * try to do this early so that it also stops using devices.
     */
    migration_shutdown();

    /*
     * Close the exports before draining the block layer. The export
     * drivers may have coroutines yielding on it, so we need to clean
     * them up before the drain, as otherwise they may be get stuck in
     * blk_wait_while_drained().
     */
    blk_exp_close_all();


    /* No more vcpu or device emulation activity beyond this point */
    vm_shutdown();
    replay_finish();

    /*
     * We must cancel all block jobs while the block layer is drained,
     * or cancelling will be affected by throttling and thus may block
     * for an extended period of time.
     * Begin the drained section after vm_shutdown() to avoid requests being
     * stuck in the BlockBackend's request queue.
     * We do not need to end this section, because we do not want any
     * requests happening from here on anyway.
     */
    bdrv_drain_all_begin();
    job_cancel_sync_all();
    bdrv_close_all();

    /* vhost-user must be cleaned up before chardevs.  */
    tpm_cleanup();
    net_cleanup();
    audio_cleanup();
    monitor_cleanup();
    qemu_chr_cleanup();
    user_creatable_cleanup();
    /* TODO: unref root container, check all devices are ok */
}


#ifdef __EMSCRIPTEN__
static DisplaySurface *do86_primary_surface(void)
{
    QemuConsole *con = qemu_console_lookup_default();
    if (!con) {
        con = qemu_console_lookup_by_index(0);
    }
    if (!con) {
        return NULL;
    }
    return qemu_console_surface(con);
}





/* ── wasm_* bridge functions (no-ASYNCIFY build) ─────────────────────────
 *
 * These exports are used by QemuWrapper in Cloudflare Workers/DOs.
 * They provide typed access to QEMU internals without requiring the
 * caller to know memory layout or device register offsets.
 *
 * When built without -sASYNCIFY=1, the __ASYNCIFY__ macro is absent and
 * the emscripten_set_main_loop() callback path is used instead.
 */

/* ── Display bridge ──────────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
void wasm_display_init(void)
{
    /* Force a full display refresh so surface data is populated */
    QemuConsole *con = qemu_console_lookup_by_index(0);
    if (con) {
        graphic_hw_update(con);
    }
}

EMSCRIPTEN_KEEPALIVE
uintptr_t wasm_get_display_surface_data(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? (uintptr_t)surface_data(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_get_display_stride(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_stride(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_get_display_width(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_width(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_get_display_height(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_height(s) : 0;
}

/* ── CPU bridge ──────────────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
void wasm_cpu_set_sipi_vector(int vector)
{
    /* In standalone single-core mode, SIPI is a no-op.
     * For distributed SMP, the coordinator handles SIPI by creating
     * a new AP Durable Object — not by modifying CPU registers here.
     * The vector is just recorded for the coordinator to use. */
    (void)vector;
}

EMSCRIPTEN_KEEPALIVE
void wasm_cpu_resume(void)
{
    CPUState *cpu = first_cpu;
    if (!cpu) return;
    cpu->stopped = false;
    cpu->stop = false;
    cpu->halted = 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_cpu_get_halted(void)
{
    CPUState *cpu = first_cpu;
    return cpu ? cpu->halted : 1;
}

EMSCRIPTEN_KEEPALIVE
unsigned int wasm_cpu_get_eip(void)
{
    CPUState *cpu = first_cpu;
    if (!cpu || !cpu->cc || !cpu->cc->get_pc) return 0;
    return (unsigned int)cpu->cc->get_pc(cpu);
}

EMSCRIPTEN_KEEPALIVE
void wasm_cpu_interrupt(int vector)
{
    CPUState *cpu = first_cpu;
    if (!cpu) return;
    cpu_interrupt(cpu, CPU_INTERRUPT_HARD);
}

EMSCRIPTEN_KEEPALIVE
void wasm_cpu_flush_tlb(void)
{
    CPUState *cpu = first_cpu;
    if (!cpu) return;
    tlb_flush(cpu);
}

EMSCRIPTEN_KEEPALIVE
void wasm_cpu_flush_tlb_page(unsigned int addr)
{
    CPUState *cpu = first_cpu;
    if (!cpu) return;
    tlb_flush_page(cpu, (vaddr)addr);
}

/* ── APIC bridge ─────────────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
int wasm_apic_get_id(void)
{
    CPUState *cpu = first_cpu;
    return cpu ? cpu->cpu_index : -1;
}

EMSCRIPTEN_KEEPALIVE
void wasm_apic_set_id(int id)
{
    /* APIC ID is set during machine init; this is a no-op placeholder
     * for the distributed SMP case where each DO has a different ID. */
    (void)id;
}

EMSCRIPTEN_KEEPALIVE
void wasm_apic_inject_irq(int vector)
{
    CPUState *cpu = first_cpu;
    if (!cpu) return;
    cpu_interrupt(cpu, CPU_INTERRUPT_HARD);
}

EMSCRIPTEN_KEEPALIVE
unsigned long long wasm_apic_read_icr(void)
{
    /* ICR (Interrupt Command Register) reading for IPI routing.
     * In single-core standalone mode, ICR is not meaningful.
     * Return 0 to indicate no pending IPI. */
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int wasm_apic_get_highest_irr(void)
{
    /* Return -1 (no pending interrupt) in standalone mode */
    return -1;
}

/* ── Page pool bridge (for SqlPageStore demand-paged RAM) ────────────── */

static uintptr_t page_pool_base = 0;

EMSCRIPTEN_KEEPALIVE
void wasm_set_page_pool_base(unsigned int base)
{
    page_pool_base = (uintptr_t)base;
}

EMSCRIPTEN_KEEPALIVE
unsigned int wasm_get_page_pool_base(void)
{
    return (unsigned int)page_pool_base;
}

EMSCRIPTEN_KEEPALIVE
int wasm_page_fault_handler(unsigned int gpa)
{
    /* Called when QEMU's softmmu can't resolve a guest physical address.
     * In standalone mode without SqlPageStore, return -1 (not handled).
     * The JS side can override this via Module.onTlbMiss EM_ASM callback. */
    return -1;
}

/* ── wasm_step: JS-driven execution pump ─────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
int wasm_step(int iterations)
{
    /*
     * Execute `iterations` main loop iterations. Each iteration drives all
     * vCPUs (1 translation block per CPU) and processes timers/events.
     *
     * Returns:
     *   0  — continue (more work to do)
     *   >0 — QEMU wants to exit (shutdown/reboot)
     *  -1  — error or no CPUs
     *
     * Called from JavaScript via setInterval. The JS side controls timing:
     * - 4ms interval for responsive execution
     * - N=8 iterations per call for throughput
     * - The interval yields to the event loop between calls, ensuring
     *   HTTP/WebSocket handlers are never starved.
     */
    int status = EXIT_SUCCESS;
    bool had_bql = bql_locked();
    static unsigned int step_call_count;

    step_call_count++;
    if (!first_cpu) {
        if (step_call_count <= 3) {
            fprintf(stdout, "[STEP] no first_cpu! call=%u\n", step_call_count);
            fflush(stdout);
        }
        return -1;
    }

    if (step_call_count <= 5 || step_call_count % 10000 == 0) {
        CPUState *cpu = first_cpu;
        fprintf(stdout, "[STEP] call=%u cpu=%p halted=%d irq=%x rs=%d icount=%d vclk=%lld\n",
                step_call_count, cpu, cpu->halted,
                cpu->interrupt_request, runstate_get(),
                icount_enabled(),
                (long long)qemu_clock_get_ns(QEMU_CLOCK_VIRTUAL));
        fflush(stdout);
    }

    if (!had_bql) {
        replay_mutex_lock();
        bql_lock();
    }

    js_pre_tick();

    for (int i = 0; i < iterations; i++) {
        do86_drive_vcpus();

        /* If CPU is halted (HLT instruction), advance QEMU virtual clocks
         * and fire any expired timers. This wakes the CPU from HLT during
         * SeaBIOS POST delays and OS idle loops.
         *
         * We avoid main_loop_wait() here because it triggers ASYNCIFY
         * unwinds via AIO coroutine processing, which breaks the step pump.
         * Instead, directly run the timer subsystem. */
        /* With -icount, run virtual clock timers to fire PIT/APIC
         * callbacks based on instruction count. This doesn't involve
         * AIO or coroutines — pure timer expiry checking. */
        qemu_clock_run_timers(QEMU_CLOCK_VIRTUAL);
        qemu_clock_run_timers(QEMU_CLOCK_REALTIME);

        if (first_cpu && first_cpu->halted) {
            first_cpu->halted = 0;
            if (!first_cpu->interrupt_request) {
                break;
            }
        }
    }

    js_post_tick();

    if (!had_bql) {
        bql_unlock();
        replay_mutex_unlock();
    }
    return 0;
}

/* ── wasm_pump_events: process AIO completions, timers, BHs ──────────── */

EMSCRIPTEN_KEEPALIVE
void wasm_pump_events(void)
{
    /*
     * Process pending async I/O completions, timer expirations, and
     * bottom-half callbacks. This is the event-processing half of the
     * main loop — separated from CPU execution (wasm_step) so that
     * ASYNCIFY unwinds during AIO processing don't interrupt the fast
     * CPU execution path.
     *
     * Called from JS via a separate setTimeout chain, at a lower
     * frequency than wasm_step. When a block I/O coroutine yields
     * (fiber swap), ASYNCIFY handles the unwind/rewind within this
     * function, and the JS caller reschedules after it returns.
     */
    bool had_bql = bql_locked();
    if (!had_bql) {
        replay_mutex_lock();
        bql_lock();
    }

    main_loop_wait(false);

    if (!had_bql) {
        bql_unlock();
        replay_mutex_unlock();
    }
}

/* ── Legacy do86_* exports (ASYNCIFY build) ──────────────────────────── */

EMSCRIPTEN_KEEPALIVE
unsigned long long do86_cpu_pc(void)
{
    CPUState *cpu = first_cpu;
    if (!cpu || !cpu->cc || !cpu->cc->get_pc) {
        return 0;
    }
    return (unsigned long long)cpu->cc->get_pc(cpu);
}

EMSCRIPTEN_KEEPALIVE
void do86_surface_refresh(void)
{
    QemuConsole *con = qemu_console_lookup_by_index(0);
    if (!con) {
        return;
    }
    graphic_hw_update(con);
    dpy_gfx_update_full(con);
}

EMSCRIPTEN_KEEPALIVE
int do86_surface_width(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_width(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int do86_surface_height(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_height(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int do86_surface_stride(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_stride(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
int do86_surface_bpp(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_bytes_per_pixel(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
unsigned int do86_surface_format(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? surface_format(s) : 0;
}

EMSCRIPTEN_KEEPALIVE
uintptr_t do86_surface_ptr(void)
{
    DisplaySurface *s = do86_primary_surface();
    return s ? (uintptr_t)surface_data(s) : 0;
}
#endif
