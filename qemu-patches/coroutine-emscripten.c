/*
 * Synchronous coroutine backend for Emscripten/WASM Durable Objects.
 *
 * DOs have no disk I/O, so QEMU coroutines never need to suspend mid-run.
 * We run each coroutine inline on the main stack. This avoids
 * emscripten_fiber_swap which is in ASYNCIFY's hardcoded import list and
 * would unwind the entire WASM stack on every coroutine switch.
 */
#include "qemu/osdep.h"
#include "qemu/coroutine_int.h"
#include "qemu/coroutine.h"

typedef struct {
    Coroutine base;
    bool finished;
} CoroutineEmscripten;

static CoroutineEmscripten leader;
static Coroutine *current;

Coroutine *qemu_coroutine_new(void)
{
    CoroutineEmscripten *co = g_new0(CoroutineEmscripten, 1);
    return &co->base;
}

void qemu_coroutine_delete(Coroutine *co_)
{
    g_free(co_);
}

CoroutineAction qemu_coroutine_switch(Coroutine *from_, Coroutine *to_,
                                       CoroutineAction action)
{
    CoroutineEmscripten *to = DO_UPCAST(CoroutineEmscripten, base, to_);

    if (action == COROUTINE_TERMINATE || to->finished) {
        to->finished = true;
        current = from_;
        return COROUTINE_TERMINATE;
    }

    Coroutine *saved = current;
    current = to_;
    to_->entry(to_->entry_arg);
    to->finished = true;
    current = saved;

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
