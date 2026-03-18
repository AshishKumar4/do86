/*
 * WASM coroutine backend.
 *
 * With ASYNCIFY: uses emscripten_fiber_t (proper async stack switching).
 * Without ASYNCIFY: runs coroutines inline. Yield/resume is faked —
 * yield returns immediately to the caller, and re-entry runs from the top.
 * This works for QEMU's block layer probing where coroutines just do
 * synchronous MEMFS I/O that completes immediately.
 */

#include "qemu/osdep.h"
#include "qemu/coroutine_int.h"
#include "qemu/coroutine.h"

#ifdef __ASYNCIFY__
/* ── ASYNCIFY path: full fiber-based coroutines ────────────────────── */

#include "qemu/coroutine-tls.h"
#include <emscripten/fiber.h>

typedef struct {
    Coroutine base;
    void *stack;
    size_t stack_size;
    void *asyncify_stack;
    size_t asyncify_stack_size;
    CoroutineAction action;
    emscripten_fiber_t fiber;
} CoroutineEmscripten;

QEMU_DEFINE_STATIC_CO_TLS(Coroutine *, current);
QEMU_DEFINE_STATIC_CO_TLS(CoroutineEmscripten *, leader);
size_t leader_asyncify_stack_size = COROUTINE_STACK_SIZE;

static void coroutine_trampoline(void *co_)
{
    Coroutine *co = co_;
    while (true) {
        co->entry(co->entry_arg);
        qemu_coroutine_switch(co, co->caller, COROUTINE_TERMINATE);
    }
}

Coroutine *qemu_coroutine_new(void)
{
    CoroutineEmscripten *co = g_malloc0(sizeof(*co));
    co->stack_size = COROUTINE_STACK_SIZE;
    co->stack = qemu_alloc_stack(&co->stack_size);
    co->asyncify_stack_size = COROUTINE_STACK_SIZE;
    co->asyncify_stack = g_malloc0(co->asyncify_stack_size);
    emscripten_fiber_init(&co->fiber, coroutine_trampoline, &co->base,
                          co->stack, co->stack_size, co->asyncify_stack,
                          co->asyncify_stack_size);
    return &co->base;
}

void qemu_coroutine_delete(Coroutine *co_)
{
    CoroutineEmscripten *co = DO_UPCAST(CoroutineEmscripten, base, co_);
    qemu_free_stack(co->stack, co->stack_size);
    g_free(co->asyncify_stack);
    g_free(co);
}

CoroutineAction qemu_coroutine_switch(Coroutine *from_, Coroutine *to_,
                                       CoroutineAction action)
{
    CoroutineEmscripten *from = DO_UPCAST(CoroutineEmscripten, base, from_);
    CoroutineEmscripten *to = DO_UPCAST(CoroutineEmscripten, base, to_);
    set_current(to_);
    to->action = action;
    emscripten_fiber_swap(&from->fiber, &to->fiber);
    return from->action;
}

Coroutine *qemu_coroutine_self(void)
{
    Coroutine *self = get_current();
    if (!self) {
        CoroutineEmscripten *leaderp = get_leader();
        if (!leaderp) {
            leaderp = g_malloc0(sizeof(*leaderp));
            leaderp->asyncify_stack = g_malloc0(leader_asyncify_stack_size);
            leaderp->asyncify_stack_size = leader_asyncify_stack_size;
            emscripten_fiber_init_from_current_context(
                &leaderp->fiber,
                leaderp->asyncify_stack,
                leaderp->asyncify_stack_size);
            leaderp->stack = leaderp->fiber.stack_limit;
            leaderp->stack_size =
                leaderp->fiber.stack_base - leaderp->fiber.stack_limit;
            set_leader(leaderp);
        }
        self = &leaderp->base;
        set_current(self);
    }
    return self;
}

bool qemu_in_coroutine(void)
{
    Coroutine *self = get_current();
    return self && self->caller;
}

#else
/* ── No-ASYNCIFY path: inline coroutines with yield→terminate ──────── */
/*
 * WASM has no stack switching without ASYNCIFY/fibers. Coroutines run
 * inline on the caller's stack:
 *
 *   qemu_coroutine_enter(co) → runs co->entry() synchronously
 *   When entry() calls qemu_coroutine_yield() → treated as "done"
 *     (the switch function returns COROUTINE_TERMINATE to the caller)
 *   Re-entering a yielded coroutine → re-runs entry() from the start
 *
 * This works for QEMU's block-layer disk probing because:
 * 1. Disk I/O is against Emscripten MEMFS (synchronous, in-memory)
 * 2. Most probe coroutines do: open → read header → yield result
 * 3. The "re-run from start" means the probe runs again — which is
 *    idempotent for read-only probing
 *
 * The key invariant: coroutine entry functions must be idempotent
 * (safe to re-run) or must complete without yielding.
 */

typedef struct {
    Coroutine base;
    CoroutineAction ret_action;  /* action to return to caller */
} CoroutineInline;

static CoroutineInline leader;
static Coroutine *current;

Coroutine *qemu_coroutine_new(void)
{
    CoroutineInline *co = g_new0(CoroutineInline, 1);
    return &co->base;
}

void qemu_coroutine_delete(Coroutine *co_)
{
    g_free(co_);
}

CoroutineAction qemu_coroutine_switch(Coroutine *from_, Coroutine *to_,
                                       CoroutineAction action)
{
    CoroutineInline *to = DO_UPCAST(CoroutineInline, base, to_);

    if (action == COROUTINE_TERMINATE) {
        current = from_;
        return COROUTINE_TERMINATE;
    }

    if (action == COROUTINE_YIELD) {
        /* Yield: the coroutine wants to return to its caller.
         * We can't actually suspend — just return to the caller.
         * Set the return action so the caller sees COROUTINE_YIELD. */
        to->ret_action = COROUTINE_YIELD;
        current = to_;
        return COROUTINE_YIELD;
    }

    /* COROUTINE_ENTER: run the coroutine's entry function inline. */
    Coroutine *saved = current;
    current = to_;
    to_->entry(to_->entry_arg);
    current = saved;

    /* Entry function returned — coroutine is done. */
    return COROUTINE_TERMINATE;
}

Coroutine *qemu_coroutine_self(void)
{
    if (!current) {
        current = &leader.base;
    }
    return current;
}

bool qemu_in_coroutine(void)
{
    return current && current != &leader.base;
}

#endif /* __ASYNCIFY__ */
