# Distributed Multi-DO Architecture for x86 SMP Emulation

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Constraints](#2-platform-constraints)
3. [Architecture Overview](#3-architecture-overview)
4. [Memory Coherence Protocol](#4-memory-coherence-protocol)
5. [Consistency Model](#5-consistency-model)
6. [IPI and Interrupt Routing](#6-ipi-and-interrupt-routing)
7. [Stratum Rust Modifications](#7-stratum-rust-modifications)
8. [DO-side TypeScript Implementation](#8-do-side-typescript-implementation)
9. [Speculative Execution and Prefetching](#9-speculative-execution-and-prefetching)
10. [Paravirtualization Extensions](#10-paravirtualization-extensions)
11. [Performance and Feasibility Analysis](#11-performance-and-feasibility-analysis)
12. [Existing Code Assessment](#12-existing-code-assessment)
13. [Phased Implementation Plan](#13-phased-implementation-plan)
14. [Risk Analysis](#14-risk-analysis)
15. [Appendix: Key Data Structures](#15-appendix-key-data-structures)

---

## 1. Executive Summary

This document specifies a distributed x86 SMP emulation architecture where
**N Durable Objects each run one virtual CPU** via stratum (our v86 fork),
presenting a unified x86 machine to the guest OS. A dedicated **CoordinatorDO**
manages memory coherence, interrupt routing, and device state; each
**CpuCoreDO** runs one stratum WASM instance executing guest instructions
independently.

The core challenge is that inter-DO RPC latency (~1-5ms) is **6 orders of
magnitude slower** than hardware cache coherence (~1-10ns). Classical DSM
systems (Ivy, TreadMarks, Munin) faced the same problem at page granularity
over Ethernet LANs. We adopt their proven techniques---directory-based coherence,
lazy release consistency, twin-and-diff write detection, epoch-based
batching---adapted to the specific constraints and advantages of our platform:

**Advantages we have that classical DSM did not:**
- We **own the CPU emulator** (stratum's Rust core) and can intercept any
  memory access at any granularity with zero hardware overhead
- Guest execution is **deterministic within an epoch** (single-threaded WASM)
- We can **batch all coherence traffic** at epoch boundaries
- We can add **paravirt extensions** to the guest kernel for cooperation
- Each DO has **10GB SQLite storage** for page backing

**Key design decisions:**
- **Hybrid adaptive consistency**: start with batched sequential consistency,
  profile page access patterns, promote hot shared pages to release consistency
- **Epoch-based execution**: each core runs ~100k instructions (one
  `do_many_cycles_native()` call) then synchronizes
- **Twin-and-diff write detection**: snapshot pages at epoch start, diff at
  epoch end to produce compact changesets
- **Speculative execution with rollback**: cores execute optimistically with
  cached pages, validate at epoch boundary, roll back on conflict
- **Stratum-native interception**: new hooks in `do_page_walk()` and
  `page_pool.rs` for coherence, reusing the existing demand-paging infrastructure

---

## 2. Platform Constraints

### 2.1 Cloudflare Durable Objects

| Constraint | Value | Impact |
|---|---|---|
| Memory per isolate | 128 MB | Each core DO gets ~128MB: ~30MB stratum WASM, ~60-80MB guest RAM partition, ~10-20MB overhead |
| CPU time per invocation | 30s (default), 5min (max) | Long-running execution via setInterval + yielding; not a hard blocker |
| Storage per DO | 10 GB (SQLite) | Ample for page backing store; page data persists across evictions |
| RPC latency (same region) | ~1-5 ms | The fundamental constraint. Every cross-DO coherence operation costs this |
| RPC latency (co-located hint) | ~0.5-2 ms | Best case with same locationHint; still 5-6 orders > hardware |
| Throughput per DO | ~500-1000 req/s | Coordinator must handle coherence RPCs from all cores |
| WebSocket message size | 32 MiB | Sufficient for bulk page transfers during boot |
| Single-threaded | Yes | No concurrent execution within a DO; simplifies coherence logic |

### 2.2 Stratum/v86 Emulator

| Property | Value |
|---|---|
| Per-CPU context size | 1,168 bytes (WASM offsets 64-1231) |
| TLB size | 1M entries (4 MB), flushed on context switch |
| Execution quantum | ~100,003 instructions per `do_many_cycles_native()` |
| Page table walk | `do_page_walk()` in cpu.rs, already has demand-paging hooks |
| Demand paging | `pool_lookup()` (WASM-side) + `swap_page_in()` (JS FFI) |
| Memory access | All through `translate_address()` -> TLB -> `do_page_walk()` |
| Physical memory | Single `mem8` allocation via `allocate_memory()` |

### 2.3 Derived Parameters

For a 2-core (BSP + 1 AP) system with 64 MB guest RAM:

| Parameter | Value | Derivation |
|---|---|---|
| Pages per core | ~8,192 (32 MB) | 64 MB / 2 cores |
| Instructions per epoch | ~100,003 | One `do_many_cycles_native()` call |
| Epochs per second per core | ~250 | 1000ms / 4ms tick interval |
| Max coherence RPCs/sec | ~250 per core | One per epoch if every epoch touches foreign pages |
| Page faults per epoch (est.) | 0-5 | Most accesses hit TLB; cold pages rare after warmup |
| Worst-case stall per fault | 2-10 ms | 1 RPC to coordinator + possibly 1 writeback from owner |

---

## 3. Architecture Overview

### 3.1 System Topology

```
                    ┌───────────────────────────────────────────┐
                    │              Browser Client                │
                    │  (WebSocket: screen, keyboard, mouse)      │
                    └────────────────┬──────────────────────────┘
                                     │ WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CoordinatorDO                                    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ PageDirectory │  │  IPIRouter   │  │    IOAPIC    │  │  DeviceMgr │ │
│  │  (coherence   │  │  (INIT/SIPI  │  │  (24-entry   │  │ (VGA,disk  │ │
│  │   directory)  │  │   + routing) │  │   redir tbl) │  │  proxy)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                  │                  │                │        │
│  ┌──────┴──────────────────┴──────────────────┴────────────────┘        │
│  │                    RPC Dispatch Layer                                │
│  └──────┬───────────────────┬───────────────────┬──────────────────────┘│
└─────────┼───────────────────┼───────────────────┼──────────────────────┘
          │ RPC               │ RPC               │ RPC
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   CpuCoreDO 0   │ │   CpuCoreDO 1   │ │   CpuCoreDO N   │
│   (BSP)         │ │   (AP)          │ │   (AP)          │
│                 │ │                 │ │                 │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │  Stratum    │ │ │ │  Stratum    │ │ │ │  Stratum    │ │
│ │  WASM       │ │ │ │  WASM       │ │ │ │  WASM       │ │
│ │  Instance   │ │ │ │  Instance   │ │ │ │  Instance   │ │
│ │             │ │ │ │             │ │ │ │             │ │
│ │ ┌─────────┐ │ │ │ ┌─────────┐ │ │ │ ┌─────────┐ │ │
│ │ │ vCPU 0  │ │ │ │ │ vCPU 1  │ │ │ │ │ vCPU N  │ │ │
│ │ │ TLB     │ │ │ │ │ TLB     │ │ │ │ │ TLB     │ │ │
│ │ │ LAPIC   │ │ │ │ │ LAPIC   │ │ │ │ │ LAPIC   │ │ │
│ │ └─────────┘ │ │ │ └─────────┘ │ │ │ └─────────┘ │ │
│ │ ┌─────────┐ │ │ │ ┌─────────┐ │ │ │ ┌─────────┐ │ │
│ │ │CoherMap │ │ │ │ │CoherMap │ │ │ │ │CoherMap │ │ │
│ │ │(WASM    │ │ │ │ │(WASM    │ │ │ │ │(WASM    │ │ │
│ │ │ array)  │ │ │ │ │ array)  │ │ │ │ │ array)  │ │ │
│ │ └─────────┘ │ │ │ └─────────┘ │ │ │ └─────────┘ │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
│                 │ │                 │ │                 │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │ EpochMgr    │ │ │ │ EpochMgr    │ │ │ │ EpochMgr    │ │
│ │ (JS-side    │ │ │ │ (JS-side    │ │ │ │ (JS-side    │ │
│ │  coherence) │ │ │ │  coherence) │ │ │ │  coherence) │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │ SQLite      │ │ │ │ SQLite      │ │ │ │ SQLite      │ │
│ │ (page       │ │ │ │ (page       │ │ │ │ (page       │ │
│ │  backing)   │ │ │ │  backing)   │ │ │ │  backing)   │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 3.2 Key Principles

1. **Each DO is independent**: runs its own stratum WASM instance with private
   WASM linear memory. No SharedArrayBuffer, no shared memory between DOs.

2. **Coordinator is the authority**: holds the canonical page directory,
   arbitrates ownership transitions, routes IPIs. Cores never communicate
   directly with each other---always through the coordinator.

3. **Epoch-based synchronization**: cores execute a quantum of instructions
   locally, then synchronize coherence state with the coordinator in a single
   batched RPC. This amortizes the ~1-5ms RPC cost across ~100k instructions.

4. **Progressive consistency**: start with the strongest model that works,
   relax only where profiling shows it's needed.

### 3.3 Memory Partitioning

Each core DO allocates WASM linear memory for its stratum instance. Guest
physical memory is **not replicated in full** across all cores. Instead:

```
Guest Physical Address Space (64 MB example):
┌──────────────────────────────────────────────────────┐
│ 0x00000000 - 0x000FFFFF: Low memory (1 MB)           │  Replicated to all cores
│   IVT, BDA, BIOS data, trampoline code               │  at boot time
├──────────────────────────────────────────────────────┤
│ 0x00100000 - 0x01FFFFFF: Kernel + data (31 MB)       │  Initially BSP-owned
│   Demand-fetched by APs on first access               │  Coherence-managed
├──────────────────────────────────────────────────────┤
│ 0x02000000 - 0x03FFFFFF: Upper memory (32 MB)        │  Initially BSP-owned
│   User space, buffers, etc.                           │  Coherence-managed
├──────────────────────────────────────────────────────┤
│ 0xFEBF0000: AHCI MMIO                                │  BSP-only (device)
│ 0xFEE00000: LAPIC MMIO                               │  Per-core (local APIC)
│ 0xFEC00000: IOAPIC MMIO                              │  Coordinator-managed
│ 0xE0000000: VGA LFB                                  │  BSP-only (device)
└──────────────────────────────────────────────────────┘
```

Each core's WASM linear memory layout:

```
WASM linear memory (per core DO):
┌────────────────────────────────────────────────────────┐
│ 0 - 63:        WASM reserved                           │
│ 64 - 1231:     CPU register state (per-CPU)            │
│ 1232 - 4095:   Other Rust statics                      │
├────────────────────────────────────────────────────────┤
│ 4096+:         Guest RAM allocation (mem8)             │
│                Hot page pool (coherence-managed pages)  │
│                Up to ~60 MB usable per core            │
├────────────────────────────────────────────────────────┤
│ Above mem8:    VGA memory, other allocations            │
└────────────────────────────────────────────────────────┘
```

---

## 4. Memory Coherence Protocol

### 4.1 Overview

The protocol is a **directory-based, page-granularity coherence protocol**
inspired by Ivy (Li & Hudak, 1989) and extended with ideas from TreadMarks
(Keleher et al., 1994). The coordinator maintains a central directory; each
core maintains a local coherence map.

### 4.2 Page States

#### 4.2.1 Coordinator Directory (PageDirectory)

Each physical page has a directory entry with one of three states:

| State | Meaning | Canonical data |
|---|---|---|
| **UNCACHED** | No core has this page | Coordinator holds canonical copy (in memory or SQLite) |
| **SHARED** | One or more cores have read-only copies | Coordinator holds canonical copy; sharer set tracked |
| **OWNED** | Exactly one core has a writable copy | Canonical data is **stale**; owner has latest version |

#### 4.2.2 Core Coherence Map (WASM-side)

Each core tracks its local view of each page:

| State | Meaning | TLB encoding |
|---|---|---|
| **INVALID** | Core does not have this page | No TLB entry; access triggers coherence fault |
| **SHARED** | Core has a read-only copy | TLB_READONLY set; write triggers upgrade fault |
| **EXCLUSIVE** | Core is the sole owner, may write freely | Normal TLB entry; no coherence overhead |
| **MODIFIED** | Core has written to an EXCLUSIVE page | Same TLB encoding; dirty bit set in coherence map |

### 4.3 State Machine

```
              COORDINATOR DIRECTORY STATE MACHINE
              ====================================

                        ┌─────────┐
                        │UNCACHED │
                        └────┬────┘
                             │
                   Core requests READ
                   Coordinator sends page data
                   Adds core to sharer set
                             │
                             ▼
                 ┌──────────────────────┐
          ┌──────│       SHARED         │──────┐
          │      │  sharers: {A, B, C}  │      │
          │      └──────────┬───────────┘      │
          │                 │                   │
    Another core       Core requests WRITE     Last sharer
    requests READ      Coordinator:            releases
    → add to sharers   1. Invalidate all       → UNCACHED
          │               other sharers
          │            2. Grant ownership
          │               to requester
          │                 │
          │                 ▼
          │      ┌──────────────────────┐
          │      │       OWNED          │
          │      │  owner: A            │
          │      └──────────┬───────────┘
          │                 │
          │      Another core requests READ or WRITE:
          │      1. Coordinator requests writeback from owner
          │      2. Owner sends dirty page data back
          │      3. Coordinator updates canonical copy
          │      4. Transition to SHARED (for READ) or
          │         OWNED by new requester (for WRITE)
          │                 │
          └─────────────────┘
```

```
              CORE LOCAL STATE MACHINE
              ========================

                     ┌─────────┐
              ┌──────│ INVALID │◄────────────────────────────┐
              │      └────┬────┘                              │
              │           │                                   │
              │    Guest READ:                        Coordinator sends
              │    → coherence_fault(gpa, false)      INVALIDATE message
              │    → RPC to coordinator: fetch_page   → flush TLB entry
              │    → receive page data                → mark INVALID
              │    → install in local mem8
              │    → set TLB entry (READONLY)
              │           │
              │           ▼
              │      ┌──────────┐
              │      │  SHARED  │────────────────────────────┐
              │      └────┬─────┘                            │
              │           │                                  │
              │    Guest WRITE:                       Coordinator sends
              │    → write fault (TLB_READONLY)       INVALIDATE
              │    → coherence_upgrade(gpa)           → flush TLB entry
              │    → RPC: upgrade_page                → mark INVALID
              │    → coordinator invalidates others
              │    → mark EXCLUSIVE locally
              │    → remove TLB_READONLY
              │           │
              │           ▼
              │    ┌────────────┐
              │    │ EXCLUSIVE  │
              │    └────┬───────┘
              │         │
              │  Guest WRITE:                    Coordinator requests
              │  → proceeds normally              WRITEBACK
              │  → twin saved at epoch start     → send diff/page to coord
              │  → mark MODIFIED                 → downgrade to SHARED
              │         │                          or INVALID
              │         ▼
              │    ┌────────────┐
              └────│ MODIFIED   │
                   └────────────┘
```

### 4.4 Twin-and-Diff Write Detection

Instead of trapping every write instruction (prohibitively expensive), we use
the **twin-and-diff** technique from TreadMarks:

1. **Epoch start**: For each page in EXCLUSIVE state, save a "twin"---a snapshot
   copy of the page data (4 KB memcpy).

2. **During epoch**: Writes proceed at full speed with no per-write overhead.
   The TLB entry has no READONLY bit; writes go directly to WASM memory.

3. **Epoch end**: For each page that was EXCLUSIVE at epoch start, compare
   current data against twin. If they differ, produce a **diff**---a compact
   encoding of only the changed bytes.

4. **Diff encoding**: Run-length encoded list of (offset, length, data) tuples.
   For typical workloads (scattered struct field updates), diffs are 10-100x
   smaller than full 4 KB pages.

```
Twin-and-Diff lifecycle:

    Epoch N start                    Epoch N end
         │                                │
         ▼                                ▼
    ┌─────────┐   Guest writes     ┌─────────────┐
    │ Save    │   during epoch     │ Diff twin   │
    │ twin of │──────────────────►│ vs current  │
    │ page P  │   (no overhead)    │ page P      │
    └─────────┘                    └──────┬──────┘
                                          │
                                    Changed?
                                   ╱         ╲
                                 Yes           No
                                  │             │
                           Send diff to    No action
                           coordinator     (page clean)
```

**Memory cost**: One twin per EXCLUSIVE page. With 1000 EXCLUSIVE pages (4 MB),
twin storage is 4 MB. Acceptable within the 128 MB budget.

### 4.5 Epoch-Based Batching

Rather than issuing an RPC for every coherence event, we **batch all coherence
operations at epoch boundaries**:

```
┌──────────────────────────────────────────────────────────┐
│                      One Epoch (~4ms)                     │
│                                                          │
│  1. Inject pending IPIs from coordinator                 │
│  2. Process incoming invalidations                       │
│     (mark pages INVALID, flush TLB entries)              │
│  3. Execute ~100k guest instructions                     │
│     - TLB miss on INVALID page → queue coherence fault   │
│     - Write to SHARED page → queue upgrade request       │
│     - Reads/writes to EXCLUSIVE → no overhead            │
│  4. Produce diffs for all MODIFIED pages                 │
│  5. Send single batched RPC to coordinator:              │
│     {                                                    │
│       epoch: N,                                          │
│       fetches: [gpa1, gpa2, ...],     // pages needed    │
│       upgrades: [gpa3, gpa4, ...],    // SHARED→EXCL     │
│       diffs: [{gpa, data}, ...],      // MODIFIED pages  │
│       ipis: [{to, vector, mode}, ...] // outbound IPIs   │
│     }                                                    │
│  6. Coordinator processes batch, returns:                │
│     {                                                    │
│       pages: [{gpa, data, state}, ...], // fetched pages │
│       invalidations: [gpa1, ...],        // from others  │
│       ipis: [{from, vector, mode}, ...], // inbound IPIs │
│       granted_upgrades: [gpa3, ...],     // confirmed    │
│     }                                                    │
│  7. Apply returned data to local memory                  │
│  8. Begin next epoch                                     │
└──────────────────────────────────────────────────────────┘
```

**Critical insight**: When a core encounters a coherence fault mid-epoch
(access to INVALID page or write to SHARED page), it has two options:

**Option A (Stall)**: Pause execution, issue synchronous RPC, resume. Costs
1-5ms of dead time per fault.

**Option B (Queue + Speculate)**: Queue the fault, map the page speculatively
(using stale/zero data), continue executing. Validate at epoch end. If any
speculative read was invalidated by another core's write, roll back the epoch.

We use **Option B** (speculative execution) with **Option A** as fallback for
pages that repeatedly cause rollbacks. See Section 9.

---

## 5. Consistency Model

### 5.1 The x86 TSO Problem

x86 implements **Total Store Order (TSO)**: stores are visible to other
processors in program order, and a store by processor A is visible to processor
B before a subsequent load by A sees any "newer" value. This is stronger than
most relaxed consistency models.

However, TSO is a **hardware guarantee between physical cores sharing a cache
hierarchy**. In a distributed system, we cannot provide TSO at the hardware
level. Instead, we observe:

**All correct SMP guest software uses explicit synchronization primitives**
(spinlocks, mutexes, barriers, atomic instructions) at shared memory access
points. Software that depends on TSO without explicit synchronization is
already broken on many real-world systems (ARM, RISC-V) and even on some x86
configurations (with non-temporal stores).

### 5.2 Lazy Release Consistency (LRC)

We adopt **Lazy Release Consistency** from TreadMarks, adapted for our
epoch-based model:

1. **Acquire**: When a core executes a synchronization acquire (LOCK prefix,
   XCHG, CMPXCHG, MFENCE, or similar), it must see all writes that happened
   before the corresponding release by other cores.

2. **Release**: When a core executes a synchronization release, all of its
   writes since the last acquire must be visible to any core that subsequently
   acquires the same synchronization variable.

3. **Between sync points**: Cores may execute with stale data. This is safe
   because the guest OS guarantees that concurrent unsynchronized accesses to
   the same memory are data races (undefined behavior in C/C++).

### 5.3 Hybrid Adaptive Model

We implement a **three-tier** consistency model that adapts per-page:

#### Tier 1: Epoch Consistency (default)

All pages start here. Coherence is enforced only at epoch boundaries. Within
an epoch, a core may see stale data for pages owned by other cores. This is
sufficient for:
- Per-CPU data (stack, per-CPU variables)
- Read-only shared data (kernel text, shared libraries)
- Data protected by locks (if lock and data are in different pages)

#### Tier 2: Sync-Point Consistency

Pages that contain synchronization variables (spinlocks, mutexes, atomic
counters) are promoted to this tier. At every LOCK-prefixed instruction or
MFENCE, the core flushes its coherence batch for these pages immediately.

Detection: When the emulator encounters a LOCK prefix, XCHG, CMPXCHG, or
MFENCE instruction that accesses a page, that page is marked as a
"sync page." Sync pages are always fetched fresh from the coordinator
before the atomic operation and written back immediately after.

#### Tier 3: Sequential Consistency (escape hatch)

Pages that cause repeated rollbacks (speculative execution failures) are
promoted to full SC. Every access to these pages triggers a synchronous RPC
to the coordinator. This is slow but correct and serves as a safety net.

```
Page Tier Promotion:

    Tier 1 (Epoch)
         │
         │ Page involved in LOCK/XCHG/CMPXCHG/MFENCE
         ▼
    Tier 2 (Sync-Point)
         │
         │ Page causes >3 speculative rollbacks in 10 epochs
         ▼
    Tier 3 (Sequential Consistency)
         │
         │ No rollbacks for 1000 epochs
         ▼
    Tier 1 (Epoch)   [demotion]
```

### 5.4 Intercepting Atomic Instructions

Stratum already decodes every x86 instruction. We add interception at:

1. **LOCK-prefixed instructions** (`instructions.rs`, `instructions_0f.rs`):
   Before executing, flush coherence for the target page. After executing,
   write back the page immediately.

2. **XCHG** (always has implicit LOCK): Same as above.

3. **MFENCE/SFENCE/LFENCE**: Flush all pending coherence operations.

4. **INVLPG**: Already intercepted; extend to notify coherence layer.

Implementation: a new Rust function `coherence_sync_page(gpa: u32)` called
from the instruction decoder, exported as a WASM import that the JS epoch
manager handles.

---

## 6. IPI and Interrupt Routing

### 6.1 Architecture

IPIs are routed through the CoordinatorDO, which acts as the interconnect
fabric (analogous to the system bus in real hardware):

```
  Core 0 (BSP)              Coordinator               Core 1 (AP)
       │                         │                         │
       │  Guest writes to        │                         │
       │  LAPIC ICR register     │                         │
       │  (MMIO 0xFEE00300)      │                         │
       │                         │                         │
       ├── IPI detected ────────►│                         │
       │   {from:0, to:1,        │                         │
       │    vector:0xEF,          │                         │
       │    mode:FIXED}           │                         │
       │                         │                         │
       │                         ├── Deliver IPI ────────►│
       │                         │   Set bit in LAPIC     │
       │                         │   IRR register         │
       │                         │                         │
       │                         │                    Next epoch:
       │                         │                    handle_irqs()
       │                         │                    picks up vector 0xEF
       │                         │                    from IRR
```

### 6.2 IPI Detection in Stratum

The existing `path2-distributed-smp` branch detects outbound IPIs by
**polling the ICR register** after each `do_tick()`. This works but has
limitations:

- **Polling overhead**: ICR comparison every 4ms even when no IPIs
- **Latency**: IPI not detected until after the current tick completes

**Improved approach** for stratum-native detection:

In stratum's `apic.rs` or `apic_mmio.rs`, the LAPIC ICR write handler
(`apic::write32` at offset 0x300) already processes the IPI locally. We add
a hook: after processing the local ICR write, call an exported function
`notify_outbound_ipi(icr0, icr1)` that the JS side picks up immediately.

```rust
// In apic.rs or apic_mmio.rs, after ICR write processing:
extern "C" {
    fn notify_outbound_ipi(icr_low: u32, icr_high: u32);
}

// Called when guest writes to LAPIC ICR:
pub fn write_icr(value: u32) {
    // ... existing ICR processing ...

    // Notify JS of outbound IPI (replaces post-tick polling)
    unsafe { notify_outbound_ipi(icr_low, icr_high); }
}
```

### 6.3 INIT/SIPI Boot Protocol

The AP boot sequence uses the existing `path2-distributed-smp` approach
(which is correct and well-implemented):

1. BSP sends **INIT IPI** to target APIC ID
   → Coordinator creates a new CpuCoreDO if it doesn't exist
   → Target core enters WAIT_FOR_SIPI state

2. BSP sends **SIPI** with vector (start address = vector * 0x1000)
   → Coordinator fetches trampoline pages from BSP (low memory + vector page)
   → Coordinator sends pages + vector to target core DO
   → Target core creates stratum instance, patches memory with trampoline
     pages, sets CPU to 16-bit real mode at CS:IP = vector:0000
   → Target core begins execution

3. AP executes trampoline code, transitions to protected mode, joins the
   kernel's scheduler

### 6.4 IOAPIC and External Interrupts

External device interrupts (keyboard, disk, timer) are routed through the
IOAPIC, which lives in the CoordinatorDO:

- Guest writes to IOAPIC redirection table → CoordinatorDO updates routing
- Device raises IRQ → CoordinatorDO looks up redirection entry, delivers
  IPI to the target core (usually BSP for most devices)
- Timer interrupts: each core has its own LAPIC timer; the IOAPIC PIT/HPET
  timer typically routes to the BSP

---

## 7. Stratum Rust Modifications

### 7.1 Overview of Changes

We modify stratum's Rust core to support distributed coherence. The changes
are **additive**---behind a compile-time feature flag `distributed_smp`---and
do not break single-DO operation.

### 7.2 New File: `src/rust/cpu/coherence.rs`

This is the WASM-side coherence state tracking:

```rust
// coherence.rs — WASM-side distributed memory coherence map
//
// COHERENCE_MAP[gpa >> 12] tracks the local state of each physical page.
// Consulted by do_page_walk() on TLB miss to determine if a page is
// locally available or requires a coherence fault to the JS layer.

/// Maximum pages tracked (same as page_pool.rs).
const MAX_PAGES: usize = 65536; // 256 MB / 4 KB

/// Page coherence states (core-local view).
#[repr(u8)]
pub enum CoherState {
    Invalid   = 0,  // Page not present locally
    Shared    = 1,  // Read-only copy; write triggers upgrade fault
    Exclusive = 2,  // Writable; may be modified
    Modified  = 3,  // Written since last epoch; diff pending
}

/// Per-page coherence state, indexed by GPA >> 12.
static mut COHERENCE_MAP: [u8; MAX_PAGES] = [0; MAX_PAGES];

/// Twin storage for modified-page diffing.
/// twin_map[gpa >> 12] = index into TWIN_POOL, or -1 if no twin.
static mut TWIN_MAP: [i32; MAX_PAGES] = [-1i32; MAX_PAGES];

/// Pool of twin page snapshots (4 KB each).
/// Sized for worst case: all pages exclusive = impractical.
/// Practical limit: ~2000 twins = 8 MB.
const MAX_TWINS: usize = 2048;
static mut TWIN_POOL: [[u8; 4096]; MAX_TWINS] = [[0u8; 4096]; MAX_TWINS];
static mut TWIN_FREE: usize = 0;

// ── Exports ──────────────────────────────────────────────────────────

/// Check coherence state for a GPA. Called from do_page_walk().
/// Returns the CoherState value.
#[no_mangle]
pub unsafe fn coherence_check(gpa: u32) -> u8 {
    let idx = (gpa >> 12) as usize;
    if idx >= MAX_PAGES { return CoherState::Invalid as u8; }
    COHERENCE_MAP[idx]
}

/// Set coherence state for a GPA. Called from JS after coordinator RPC.
#[no_mangle]
pub unsafe fn coherence_set_state(gpa: u32, state: u8) {
    let idx = (gpa >> 12) as usize;
    if idx < MAX_PAGES {
        COHERENCE_MAP[idx] = state;
    }
}

/// Save a twin (snapshot) of a page for later diffing.
/// Called at epoch start for all EXCLUSIVE pages.
/// Returns twin index, or -1 if pool exhausted.
#[no_mangle]
pub unsafe fn coherence_save_twin(gpa: u32, wasm_offset: u32) -> i32 {
    if TWIN_FREE >= MAX_TWINS { return -1; }
    let idx = (gpa >> 12) as usize;
    if idx >= MAX_PAGES { return -1; }

    let twin_idx = TWIN_FREE;
    TWIN_FREE += 1;

    let src = wasm_offset as *const u8;
    let dst = TWIN_POOL[twin_idx].as_mut_ptr();
    core::ptr::copy_nonoverlapping(src, dst, 4096);
    TWIN_MAP[idx] = twin_idx as i32;

    twin_idx as i32
}

/// Produce a diff between current page data and its twin.
/// Returns the number of changed bytes (0 = clean).
/// The JS side reads the diff data from a shared buffer.
#[no_mangle]
pub unsafe fn coherence_diff_page(
    gpa: u32,
    wasm_offset: u32,
    diff_buf: u32,      // WASM offset of diff output buffer
    diff_buf_len: u32,  // max bytes available in diff buffer
) -> u32 {
    let idx = (gpa >> 12) as usize;
    if idx >= MAX_PAGES { return 0; }
    let twin_idx = TWIN_MAP[idx];
    if twin_idx < 0 { return 0; }

    let current = core::slice::from_raw_parts(wasm_offset as *const u8, 4096);
    let twin = &TWIN_POOL[twin_idx as usize];
    let out = core::slice::from_raw_parts_mut(diff_buf as *mut u8, diff_buf_len as usize);

    // Simple RLE diff: for each changed run, emit (offset:u16, len:u16, data...)
    let mut out_pos = 0usize;
    let mut i = 0usize;
    while i < 4096 {
        if current[i] != twin[i] {
            let start = i;
            while i < 4096 && current[i] != twin[i] && (i - start) < 65535 {
                i += 1;
            }
            let run_len = i - start;
            // Check space: 4 bytes header + run_len data
            if out_pos + 4 + run_len > diff_buf_len as usize {
                // Buffer full; return what we have
                break;
            }
            // Write header
            out[out_pos]     = (start & 0xFF) as u8;
            out[out_pos + 1] = ((start >> 8) & 0xFF) as u8;
            out[out_pos + 2] = (run_len & 0xFF) as u8;
            out[out_pos + 3] = ((run_len >> 8) & 0xFF) as u8;
            out_pos += 4;
            // Write data
            out[out_pos..out_pos + run_len].copy_from_slice(&current[start..start + run_len]);
            out_pos += run_len;
        } else {
            i += 1;
        }
    }
    out_pos as u32
}

/// Reset twin tracking for a new epoch.
#[no_mangle]
pub unsafe fn coherence_reset_twins() {
    TWIN_FREE = 0;
    for i in 0..MAX_PAGES {
        TWIN_MAP[i] = -1;
    }
}

/// Invalidate a page (called when coordinator sends invalidation).
/// Clears coherence state and flushes TLB entry if present.
#[no_mangle]
pub unsafe fn coherence_invalidate(gpa: u32) {
    let idx = (gpa >> 12) as usize;
    if idx < MAX_PAGES {
        COHERENCE_MAP[idx] = CoherState::Invalid as u8;
    }
    // Flush TLB entries for any virtual address mapping to this GPA.
    // We use full_clear_tlb() for simplicity; a targeted invlpg would
    // require reverse-mapping GPA→VA which we don't maintain.
    crate::cpu::cpu::full_clear_tlb();
}

/// Bulk-set coherence state (used during boot: all pages → EXCLUSIVE for BSP).
#[no_mangle]
pub unsafe fn coherence_set_all(state: u8) {
    for i in 0..MAX_PAGES {
        COHERENCE_MAP[i] = state;
    }
}
```

### 7.3 Modification to `do_page_walk()` (cpu.rs)

The key integration point. After the existing demand-paging check, we add a
coherence check:

```rust
// In do_page_walk(), after line ~2143 (existing demand-paging block):

// ── Distributed coherence check ─────────────────────────────────────
// When running in distributed mode, check if this GPA is locally
// available at the required access level.
#[cfg(feature = "distributed_smp")]
{
    let coher_state = crate::cpu::coherence::coherence_check(high);
    match coher_state {
        0 /* Invalid */ => {
            // Page not present locally. Signal coherence fault to JS.
            // JS will fetch from coordinator via RPC.
            let result = memory::ext::coherence_fault(high, for_writing as i32);
            if result >= 0 {
                high = result as u32;  // JS returned WASM offset of fetched page
            }
            // On -1: page unavailable; fall through to MMIO handling
        }
        1 /* Shared */ if for_writing => {
            // Write to SHARED page: need upgrade.
            let result = memory::ext::coherence_upgrade(high, 1);
            if result >= 0 {
                high = result as u32;
            }
        }
        _ => {
            // SHARED (read) or EXCLUSIVE/MODIFIED: page is locally available.
            // Just resolve GPA → WASM offset via pool_lookup.
        }
    }
}
```

New FFI imports in `memory.rs`:

```rust
extern "C" {
    /// Coherence fault: page is INVALID locally. JS fetches from coordinator.
    /// Returns WASM byte offset of the page, or -1 on failure.
    pub fn coherence_fault(gpa: u32, for_writing: i32) -> i32;

    /// Coherence upgrade: SHARED page needs write access. JS contacts coordinator.
    /// Returns WASM byte offset, or -1 on failure.
    pub fn coherence_upgrade(gpa: u32, for_writing: i32) -> i32;

    /// Notify JS of outbound IPI (from LAPIC ICR write).
    pub fn notify_outbound_ipi(icr_low: u32, icr_high: u32);
}
```

### 7.4 Integration with Existing Demand Paging

The distributed coherence layer sits **above** the existing demand-paging
layer (page_pool.rs + SqlPageStore):

```
Guest Memory Access
       │
       ▼
  translate_address()
       │
  TLB hit? ──Yes──► Direct memory access (fast path)
       │
      No (TLB miss)
       │
       ▼
  do_page_walk()
       │
       ├── x86 page table walk (CR3 → PDE → PTE → GPA)
       │
       ▼
  [distributed_smp] coherence_check(GPA)
       │
       ├── INVALID → coherence_fault() → JS RPC → fetch page from coordinator
       ├── SHARED + write → coherence_upgrade() → JS RPC → upgrade ownership
       └── EXCLUSIVE/MODIFIED → proceed
       │
       ▼
  [demand paging] pool_lookup(GPA)
       │
       ├── Hit → WASM offset (no FFI)
       └── Miss → swap_page_in() → SQLite → WASM offset
       │
       ▼
  Build TLB entry with WASM offset
```

In distributed mode, the `swap_page_in` function is **repurposed**: instead
of reading from local SQLite, it reads from the coherence layer's local page
cache (which was populated by the coordinator fetch).

### 7.5 Modifications Summary

| File | Change | Risk |
|---|---|---|
| `cpu.rs:do_page_walk()` | Add coherence check after page table walk | Low: behind feature flag, existing path unchanged |
| `memory.rs` | Add `coherence_fault`, `coherence_upgrade`, `notify_outbound_ipi` FFI imports | Low: only linked in distributed mode |
| NEW `coherence.rs` | Coherence map, twin/diff logic | New code, well-isolated |
| `page_pool.rs` | No changes needed | Pool serves as local page cache for both modes |
| `apic.rs` / `apic_mmio.rs` | Add `notify_outbound_ipi` call on ICR write | Low: additive |
| `lib.rs` | Export new coherence functions | Additive |

---

## 8. DO-side TypeScript Implementation

### 8.1 CoordinatorDO Enhancements

The existing `coordinator-do.ts` from `path2-distributed-smp` provides the
right structure. Key additions for epoch-based coherence:

```typescript
// New RPC method: batched epoch synchronization
async syncEpoch(coreId: number, batch: EpochBatch): Promise<EpochResponse> {
  const response: EpochResponse = {
    pages: [],
    invalidations: [],
    ipis: this.pendingIPIsFor(coreId),
    grantedUpgrades: [],
  };

  // Process page fetches
  for (const gpa of batch.fetches) {
    const pageData = await this.resolvePage(gpa, coreId, false);
    if (pageData) {
      response.pages.push({ gpa, data: pageData, state: 'shared' });
    }
  }

  // Process upgrade requests
  for (const gpa of batch.upgrades) {
    const result = this.pageDir.upgradePage(gpa, coreId);
    // Queue invalidations for other cores (delivered in their next syncEpoch)
    for (const targetCore of result.coresToInvalidate) {
      this.queueInvalidation(targetCore, gpa);
    }
    response.grantedUpgrades.push(gpa);
  }

  // Process diffs (dirty page writebacks)
  for (const diff of batch.diffs) {
    this.pageDir.applyDiff(diff.gpa, coreId, diff.data);
  }

  // Route outbound IPIs
  for (const ipi of batch.ipis) {
    await this.ipiRouter.route(ipi);
  }

  return response;
}
```

### 8.2 CpuCoreDO Epoch Manager

Each core DO has an **EpochManager** that coordinates the execution loop:

```typescript
class EpochManager {
  private epoch = 0;
  private pendingFetches: number[] = [];
  private pendingUpgrades: number[] = [];
  private outboundIPIs: IPIMessage[] = [];

  // Called from WASM via coherence_fault FFI import
  onCoherenceFault(gpa: number, forWriting: boolean): number {
    if (this.speculativeMode) {
      // Queue for batch; return speculative data
      this.pendingFetches.push(gpa);
      return this.speculativeMap(gpa);
    }
    // Synchronous mode: stall and fetch
    // (Used for Tier 3 / SC pages only)
    return this.synchronousFetch(gpa, forWriting);
  }

  // Called from WASM via coherence_upgrade FFI import
  onCoherenceUpgrade(gpa: number): number {
    this.pendingUpgrades.push(gpa);
    // In speculative mode, allow the write locally
    return this.localOffset(gpa);
  }

  // Called at end of each execution quantum
  async endEpoch(): Promise<void> {
    // 1. Collect diffs from WASM
    const diffs = this.collectDiffs();

    // 2. Send batched sync RPC to coordinator
    const response = await this.coordinator.syncEpoch(this.coreId, {
      epoch: this.epoch,
      fetches: this.pendingFetches,
      upgrades: this.pendingUpgrades,
      diffs: diffs,
      ipis: this.outboundIPIs,
    });

    // 3. Apply response: install fetched pages, process invalidations
    for (const page of response.pages) {
      this.installPage(page.gpa, page.data, page.state);
    }
    for (const gpa of response.invalidations) {
      this.wasmExports.coherence_invalidate(gpa);
    }

    // 4. Inject inbound IPIs into LAPIC
    for (const ipi of response.ipis) {
      this.injectIPI(ipi);
    }

    // 5. Validate speculative execution (if applicable)
    if (this.speculativeMode && response.invalidations.length > 0) {
      if (this.speculativeConflict(response.invalidations)) {
        this.rollbackEpoch();
        return;
      }
    }

    // 6. Save twins for next epoch
    this.saveTwins();

    // 7. Advance epoch
    this.pendingFetches = [];
    this.pendingUpgrades = [];
    this.outboundIPIs = [];
    this.epoch++;
  }
}
```

### 8.3 Execution Loop

```typescript
// In CpuCoreDO, replacing the simple setInterval:
private async executionLoop(): Promise<void> {
  while (this.state === CoreState.RUNNING) {
    // 1. Pre-epoch: apply queued invalidations and IPIs
    this.epochMgr.applyPendingInvalidations();
    this.injectPendingIPIs();

    // 2. Execute one quantum of guest instructions
    const v86 = (this.emulator as any).v86;
    v86.do_tick();  // runs ~100k instructions

    // 3. Check for outbound IPIs (via notify_outbound_ipi hook)
    // (Already captured by the WASM→JS callback during execution)

    // 4. End-of-epoch synchronization with coordinator
    await this.epochMgr.endEpoch();

    // 5. Yield to event loop (allow RPC responses, timer callbacks)
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

### 8.4 PageDirectory Enhancements

The existing `memory-coherence.ts` PageDirectory needs extensions for
epoch-based operation:

```typescript
// Additions to PageDirectory:

// Per-core invalidation queues (delivered during syncEpoch)
private invalidationQueues = new Map<number, number[]>();

// Diff application
applyDiff(gpa: number, fromCore: number, diffData: ArrayBuffer): void {
  const entry = this.getEntry(gpa >> 12);
  if (!entry.data) {
    entry.data = new ArrayBuffer(PAGE_SIZE);
  }
  // Apply RLE-encoded diff to canonical data
  const canonical = new Uint8Array(entry.data);
  const diff = new Uint8Array(diffData);
  let pos = 0;
  while (pos + 4 <= diff.length) {
    const offset = diff[pos] | (diff[pos + 1] << 8);
    const len = diff[pos + 2] | (diff[pos + 3] << 8);
    pos += 4;
    if (pos + len > diff.length) break;
    canonical.set(diff.subarray(pos, pos + len), offset);
    pos += len;
  }
}

// Queue invalidation for delivery during target's next syncEpoch
queueInvalidation(targetCore: number, gpa: number): void {
  let queue = this.invalidationQueues.get(targetCore);
  if (!queue) {
    queue = [];
    this.invalidationQueues.set(targetCore, queue);
  }
  queue.push(gpa);
}

// Drain invalidation queue for a core (called during syncEpoch)
drainInvalidations(coreId: number): number[] {
  const queue = this.invalidationQueues.get(coreId) || [];
  this.invalidationQueues.set(coreId, []);
  return queue;
}
```

---

## 9. Speculative Execution and Prefetching

### 9.1 Speculative Reads

When a core encounters a coherence fault (read to INVALID page), rather than
stalling for 1-5ms, it can:

1. **Return zero-filled or stale data** for the page
2. **Record** that this page was speculatively read
3. **Continue execution** for the remainder of the epoch

At epoch end, the coordinator reports which pages were invalidated by other
cores during this epoch. If any speculatively-read page was invalidated, the
core must **roll back**:

1. Restore CPU context to the epoch-start snapshot
2. Restore all MODIFIED pages from their twins
3. Re-execute the epoch with the correct page data (now fetched from coordinator)

### 9.2 Rollback Mechanism

```
Epoch N:
  save_cpu_context()  ──► saved_context
  save twins for all EXCLUSIVE pages

  execute ~100k instructions (speculative)
    ├── read page P (INVALID) → return stale data, record P
    ├── write page Q (EXCLUSIVE) → proceed normally
    └── ... more instructions ...

  endEpoch():
    sync with coordinator
    coordinator says: "page P was written by Core 2 during epoch N"

    CONFLICT! Page P was speculatively read with stale data.

    ROLLBACK:
      restore_cpu_context(saved_context)
      restore page Q from twin
      fetch page P from coordinator (now has correct data)
      re-execute epoch N
```

### 9.3 Prefetching Strategies

To reduce coherence faults, we implement two prefetching strategies:

#### Stride-Based Prefetch

If a core accesses pages P, P+1, P+2 in successive epochs, prefetch P+3
in the batch RPC:

```typescript
// In EpochManager:
private accessHistory: number[] = [];  // last N page accesses

predictPrefetch(): number[] {
  if (this.accessHistory.length < 3) return [];
  const last = this.accessHistory.slice(-3);
  const stride1 = last[1] - last[0];
  const stride2 = last[2] - last[1];
  if (stride1 === stride2 && stride1 !== 0) {
    return [last[2] + stride1];  // predict next page
  }
  return [];
}
```

#### Spatial Prefetch

When fetching page P, also fetch P+1 and P-1 (spatial locality). This
is cheap to add to the batch RPC:

```typescript
// In syncEpoch batch construction:
for (const gpa of pendingFetches) {
  batchFetches.push(gpa);
  batchFetches.push(gpa + PAGE_SIZE);   // spatial: next page
  batchFetches.push(gpa - PAGE_SIZE);   // spatial: prev page
}
```

### 9.4 Working Set Prediction

During boot and kernel initialization, the BSP touches almost all memory.
Rather than fault-in pages one at a time as APs start, we can **predict**
the AP working set:

1. **Low memory (0-1MB)**: Always replicate to all cores at boot
2. **Kernel text**: Detected via CR3 page table walk; pre-share as read-only
3. **Per-CPU data**: Linux allocates per-CPU regions at known offsets; detect
   via pattern matching on kernel data structures

---

## 10. Paravirtualization Extensions

### 10.1 Motivation

A stock Linux kernel running on our distributed SMP will work, but suboptimally.
Paravirt extensions allow the guest to **cooperate** with the coherence layer:

### 10.2 Hypercall Interface

We define a set of hypercalls via unused I/O ports (similar to KVM's approach):

| Port | Direction | Hypercall | Description |
|---|---|---|
| 0x510 | OUT (32-bit) | PARAVIRT_HINT_PRIVATE | Declare page range as per-CPU private (no coherence needed) |
| 0x511 | OUT (32-bit) | PARAVIRT_HINT_SHARED_RO | Declare page range as shared read-only |
| 0x512 | OUT (32-bit) | PARAVIRT_HINT_SYNC | Explicit synchronization barrier |
| 0x513 | OUT (32-bit) | PARAVIRT_YIELD | Yield remaining epoch quantum |
| 0x514 | IN (32-bit) | PARAVIRT_CORE_ID | Read distributed core ID |

### 10.3 Guest Kernel Module

A lightweight kernel module (or initrd-loaded driver) that:

1. Detects the paravirt interface via CPUID leaf or I/O port probe
2. Annotates per-CPU memory regions as PRIVATE
3. Annotates kernel text and rodata as SHARED_RO
4. Inserts SYNC hints at strategic points (after lock release, before barriers)

This is **optional**---the system works without it, just slower.

### 10.4 Page Classification Hints

The biggest performance win from paravirt:

- **Per-CPU pages** (~25% of kernel memory): Never need coherence. The guest
  kernel tells us which pages are per-CPU, and we mark them EXCLUSIVE forever
  with no tracking overhead.

- **Kernel text/rodata** (~10% of memory): Shared read-only. Never modified
  after boot. Mark as SHARED and never upgrade/invalidate.

- **Stack pages**: Per-CPU. Same as per-CPU pages.

- **Heap/data pages**: These are the only ones that actually need full coherence.
  By eliminating the others, we reduce coherence traffic by ~35%.

---

## 11. Performance and Feasibility Analysis

### 11.1 Memory Budget (128 MB per DO)

```
Stratum WASM instance:
  - WASM module code:                  ~3 MB
  - WASM linear memory base:          ~1 MB  (Rust statics, CPU state)
  - Guest RAM allocation (mem8):       ~50 MB (for 64 MB guest with 2 cores)
  - VGA memory:                        ~8 MB
  - TLB arrays (Rust statics):        ~4 MB
  - Coherence map + twin pool:        ~9 MB  (256 KB map + 8 MB twins)
  - JIT code cache:                   ~5 MB
                                    ────────
  Total WASM + data:                  ~80 MB

JS overhead:
  - V8 isolate baseline:             ~10 MB
  - EpochManager, PageCache:          ~5 MB
  - RPC buffers, serialization:       ~3 MB
                                    ────────
  Total JS:                           ~18 MB

  GRAND TOTAL:                        ~98 MB  (under 128 MB limit)
```

For **2 cores with 64 MB guest RAM**, each core holds ~32 MB of guest pages
locally, which fits comfortably. For **4 cores with 128 MB guest RAM**, each
core would hold ~32 MB, still fitting but with tighter margins. Beyond 4 cores,
we need to reduce per-core guest RAM or use more aggressive demand paging.

### 11.2 Throughput Analysis

**Best case (per-CPU workload, no sharing)**:
- Cores execute independently with no coherence RPCs
- ~250 epochs/sec × ~100k instructions/epoch = **~25M instructions/sec/core**
- With 2 cores: ~50M total instructions/sec
- Comparable to single-DO stratum performance (no overhead)

**Typical case (moderate sharing)**:
- Each epoch touches ~2 shared pages (kernel data structures)
- 2 coherence RPCs per epoch → 1 batched syncEpoch RPC every 4ms
- RPC overhead: ~2ms per syncEpoch → ~50% of epoch time in I/O wait
- Net throughput: **~12M instructions/sec/core** (2× slower than single-core)

**Worst case (heavy sharing, false sharing)**:
- Every epoch touches pages modified by other cores
- Speculative rollbacks: ~10% of epochs rolled back
- Net throughput: **~5M instructions/sec/core** (5× slower than single-core)
- Still usable for light workloads (kernel boot, simple programs)

### 11.3 Latency Analysis

| Operation | Latency | Notes |
|---|---|---|
| TLB hit (normal access) | ~0 (WASM native) | Same as single-DO |
| TLB miss → pool_lookup hit | ~1 μs | WASM array lookup |
| TLB miss → coherence check (EXCLUSIVE) | ~2 μs | WASM array lookup + pool |
| TLB miss → coherence fault (INVALID) | ~1-5 ms | RPC to coordinator |
| Write to SHARED page → upgrade | ~1-5 ms | RPC to coordinator |
| Epoch sync (batched) | ~2-5 ms | Single RPC with all operations |
| IPI delivery | ~2-10 ms | RPC from source → coordinator → target |
| INIT/SIPI (AP boot) | ~50-200 ms | Multiple RPCs + WASM instantiation |

### 11.4 SQLite Storage Feasibility

Each core DO has 10 GB SQLite storage, used for:

- **Page backing store**: cold pages that don't fit in WASM memory
  - 64 MB guest RAM / 4 KB pages = 16,384 rows max
  - At 4 KB per row = 64 MB of SQLite data
  - Well within 10 GB limit

- **Checkpoint/snapshot**: full guest state for suspend/resume

- **Coherence log**: optional write-ahead log for crash recovery

SQLite read latency (~0.1-1ms for single row by primary key) is comparable to
inter-DO RPC latency, so using SQLite as a secondary page store adds minimal
overhead on top of the coherence protocol.

### 11.5 Coordinator Bottleneck Analysis

The coordinator handles all coherence RPCs from all cores. With N cores:

- **syncEpoch RPCs**: N per epoch (~4ms) = N × 250/sec = 250-1000/sec for 1-4 cores
- Each syncEpoch involves: directory lookups (O(1) per page), invalidation
  queueing, diff application, IPI routing
- At ~500-1000 req/sec capacity, a single coordinator can handle 2-4 cores

For >4 cores, we may need to:
1. Increase epoch length (reduce RPC frequency)
2. Shard the coordinator (separate coherence + IPI coordinators)
3. Use hierarchical coherence (local clusters + global coordinator)

---

## 12. Existing Code Assessment

### 12.1 Component-by-Component Analysis

#### `coordinator-do.ts` — **Reuse ~80%**

| Aspect | Assessment |
|---|---|
| Overall structure | Excellent. DurableObject class, env bindings, core management, WebSocket handling. Keep. |
| `CoreStubRPC` interface | Good foundation. Extend with `syncEpoch()`, remove per-page `fetchPage`/`upgradePage`/`writeback`. |
| Boot pipeline (`bootVM`) | Solid. Asset loading, BIOS/disk handling, INIT/SIPI callbacks. Keep with minor tweaks. |
| Core creation (`createCore`) | Keep as-is. locationHint approach is correct. |
| Memory coherence RPCs | **Rewrite**: current per-page `fetchPage`/`upgradePage` should become batched `syncEpoch`. |
| Render loop | Keep as-is. Frame fetching from BSP via RPC works. |
| WebSocket handling | Keep as-is. Input forwarding to BSP is correct. |
| `PageDirectory` instantiation | Move to enhanced version (Section 8.4). |

#### `core-do.ts` — **Rewrite ~60%**

| Aspect | Assessment |
|---|---|
| BSP emulator creation | Good. Keep `createBSPEmulator` with minor changes for coherence hook wiring. |
| AP emulator creation | **Rewrite**: Current approach boots full BIOS then patches WASM memory directly. With stratum-native SMP, use `initialize_ap_context` from Rust instead. |
| Execution loop | **Rewrite**: Replace `setInterval(() => do_tick(), 4)` with async epoch loop (Section 8.3). |
| IPI detection | **Rewrite**: Replace post-tick ICR polling with stratum-native `notify_outbound_ipi` hook. |
| IPI injection | Good. `injectPendingIPIs` writing to LAPIC IRR in WASM memory works. Keep. |
| Memory coherence | **Rewrite**: Current `CorePageCache` is JS-side only and disconnected from stratum. Replace with `EpochManager` that bridges WASM coherence_map ↔ coordinator RPCs. |
| Screen/VGA/Serial | Keep as-is. BSP-only rendering works. |
| Input forwarding | Keep as-is. |

#### `memory-coherence.ts` — **Rewrite ~70%**

| Aspect | Assessment |
|---|---|
| `PageDirectory` class | Good concept. Extend with: epoch-based sync, diff application, invalidation queues, per-page tier tracking. |
| `CorePageCache` class | **Remove**: replaced by WASM-side `coherence.rs` + JS-side `EpochManager`. |
| State enums | Keep `DirPageState`, extend `CorePageState` to INVALID/SHARED/EXCLUSIVE/MODIFIED. |
| `fetchPage`/`upgradePage`/`acceptWriteback` | Correct protocol logic. Adapt to batched operation in `syncEpoch`. |
| `importPages` | Keep for boot-time memory population. |

#### `ipi-handler.ts` — **Reuse ~90%**

| Aspect | Assessment |
|---|---|
| `IPIMessage` interface | Perfect. Keep. |
| `decodeICR` function | Correct x86 LAPIC ICR decoding. Keep. |
| `IPIRouter` class | Excellent. INIT/SIPI protocol, broadcast resolution, core creation callbacks. Keep. |
| `IOAPIC` class | Good. 24-entry redirection table, IRQ routing. Keep. |
| IPI delivery via fire-and-forget | **Change**: batch IPIs into syncEpoch instead of fire-and-forget RPC per IPI. |

### 12.2 Stratum Code Assessment

#### `cpu_context.rs` — **Reuse 100%**

The context save/restore is exactly what we need. Each core DO uses this
for epoch-start checkpointing (for speculative rollback).

#### `cpu_smp.rs` — **Not used in distributed mode**

The cooperative SMP loop (`cpu_loop_smp`) is designed for single-DO operation
(multiple vCPUs time-sharing one WASM instance). In distributed mode, each
DO runs exactly one vCPU---there's no context switching within a DO.

However, the `SmpManager`, `start_application_processor`, and
`handle_cpu_interrupt` functions are useful reference implementations.

#### `page_pool.rs` — **Reuse 100%**

The pool_lookup / pool_register / pool_unregister mechanism works perfectly
as the local page cache for each core's coherence-managed pages. No changes
needed.

#### `apic_smp.rs` / `apic_mmio.rs` — **Adapt**

In distributed mode, the APIC system works differently:
- Each core DO has its own LAPIC (already per-instance)
- IOAPIC is in the coordinator (not in WASM)
- IPI delivery crosses DO boundaries (via coordinator RPC)

We keep the per-CPU LAPIC logic but replace the IPI delivery path with the
`notify_outbound_ipi` hook.

---

## 13. Phased Implementation Plan

### Phase 0: Foundation (Prerequisites)

**Goal**: Build stratum with WASM, confirm SMP exports work.

Tasks:
1. Install Rust toolchain (`rustup`, `wasm32-unknown-unknown`, `clang`)
2. Generate instruction tables (`bun gen/generate_*.js`)
3. Build `v86-debug.wasm` and verify SMP exports
4. Confirm `cpu_context.rs` context save/restore works
5. Confirm `cpu_loop_smp` executes guest instructions for APs

**Deliverable**: Single-DO stratum with working cooperative SMP (time-shared).

**Duration**: 1-2 weeks.

### Phase 1: Distributed Boot

**Goal**: Two DOs, each running one stratum instance. BSP boots Linux, sends
INIT/SIPI to AP DO, AP starts executing trampoline code.

Tasks:
1. Create `CpuCoreDO` that instantiates stratum WASM (not v86 JS wrapper)
2. Wire WASM imports (memory, coherence stubs, IPI hook)
3. Implement `CoordinatorDO` boot pipeline: create BSP DO, load BIOS + disk
4. Implement INIT/SIPI flow: coordinator creates AP DO, transfers trampoline
   pages, AP begins execution
5. Memory model: simple **full replication** of low memory (0-1MB) to AP at boot,
   rest of memory BSP-only initially

**Deliverable**: 2-DO system where AP starts executing but crashes when it tries
to access memory outside the trampoline region (coherence not yet implemented).

**Duration**: 2-3 weeks.

### Phase 2: Basic Coherence

**Goal**: Directory-based coherence with synchronous per-fault RPCs. Slow but
correct.

Tasks:
1. Implement `coherence.rs` (WASM-side coherence map)
2. Add coherence check to `do_page_walk()` in stratum
3. Implement `coherence_fault` and `coherence_upgrade` FFI imports
4. Implement `PageDirectory` in coordinator with UNCACHED/SHARED/OWNED states
5. Implement synchronous fetch/upgrade/writeback RPCs
6. Boot Linux SMP kernel with 2 cores and confirm both cores are visible
   (`/proc/cpuinfo` shows 2 CPUs)

**Deliverable**: 2-core Linux SMP boot. Very slow (every shared page access
causes an RPC stall) but functionally correct.

**Duration**: 3-4 weeks.

### Phase 3: Epoch-Based Batching

**Goal**: Replace per-fault synchronous RPCs with epoch-based batching.
Major performance improvement.

Tasks:
1. Implement `EpochManager` in core DO
2. Convert execution loop to async epoch pattern
3. Implement `syncEpoch` batched RPC on coordinator
4. Implement twin-and-diff write detection
5. Queue coherence faults during epoch, resolve in batch
6. Benchmark: measure epochs/sec, RPCs/sec, page faults/epoch

**Deliverable**: 2-core system running at ~50% of single-core speed for
per-CPU workloads.

**Duration**: 2-3 weeks.

### Phase 4: Speculative Execution

**Goal**: Cores execute speculatively with stale data, validate at epoch end,
rollback on conflict.

Tasks:
1. Implement epoch-start CPU context snapshot (for rollback)
2. Implement speculative read tracking
3. Implement conflict detection at epoch end
4. Implement rollback: restore context + twin pages + re-execute
5. Implement tier promotion (Epoch → Sync-Point → SC) based on rollback rate

**Deliverable**: Reduced stall time for shared-data workloads. Most epochs
complete without rollback.

**Duration**: 2-3 weeks.

### Phase 5: Optimizations

**Goal**: Performance tuning to approach 2× single-core for typical workloads.

Tasks:
1. Implement stride-based and spatial prefetching
2. Implement LOCK/XCHG/MFENCE interception for sync-point consistency
3. Optimize diff encoding (skip zero runs, use smaller headers)
4. Implement IPI batching in syncEpoch
5. Tune epoch length dynamically based on fault rate
6. Profile and optimize coordinator hot paths

**Deliverable**: Production-quality 2-4 core distributed SMP.

**Duration**: 3-4 weeks.

### Phase 6: Paravirtualization (Optional)

**Goal**: Guest kernel cooperation for maximum performance.

Tasks:
1. Implement hypercall I/O port interface in stratum
2. Write Linux kernel module for page classification hints
3. Implement PRIVATE/SHARED_RO page handling (skip coherence)
4. Measure performance improvement from paravirt hints

**Deliverable**: ~35% reduction in coherence traffic for paravirt-enabled guests.

**Duration**: 2-3 weeks.

### Timeline Summary

```
Phase 0 ████░░░░░░░░░░░░░░░░░░░░░░░░░░  Wk 1-2
Phase 1 ░░░░████░░░░░░░░░░░░░░░░░░░░░░  Wk 3-5
Phase 2 ░░░░░░░░██████░░░░░░░░░░░░░░░░  Wk 6-9
Phase 3 ░░░░░░░░░░░░░░████░░░░░░░░░░░░  Wk 10-12
Phase 4 ░░░░░░░░░░░░░░░░░░████░░░░░░░░  Wk 13-15
Phase 5 ░░░░░░░░░░░░░░░░░░░░░░██████░░  Wk 16-19
Phase 6 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  Wk 20-22
```

---

## 14. Risk Analysis

### 14.1 Critical Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **RPC latency too high for any usable performance** | High | Medium | Epoch batching reduces RPC count to ~250/sec/core. Speculative execution hides latency. If still too slow, increase epoch size (trade latency for throughput). |
| **128 MB memory limit exceeded** | High | Medium | Reduce guest RAM per core, increase demand-paging aggressiveness, reduce twin pool size. Worst case: limit to 2 cores or smaller guest RAM. |
| **Coordinator becomes bottleneck at >2 cores** | High | High | Shard coordinator: separate coherence director from IPI router. Use hierarchical directory for >4 cores. |
| **False sharing causes excessive coherence traffic** | Medium | High | Twin-and-diff produces byte-level diffs, avoiding full-page transfers. Tier promotion moves hot shared pages to sync-point consistency. Paravirt hints eliminate false sharing for per-CPU pages. |
| **Speculative rollbacks too frequent** | Medium | Medium | Tier promotion to SC for rollback-prone pages. Reduce speculation window. Profile and identify problematic pages. |
| **Linux SMP kernel makes assumptions incompatible with our model** | Medium | Low | Linux SMP is designed for real hardware and is very tolerant of latency. The INIT/SIPI protocol, APIC, and memory model are well-understood. Main risk: TSC synchronization (mitigated by TSC offset copying). |

### 14.2 Known Limitations

1. **No more than ~4 cores**: Memory per DO limits guest RAM partitioning.
   The coordinator throughput limit (~1000 RPCs/sec) also caps core count.

2. **High-contention workloads will be slow**: Programs that frequently
   write to the same cache line from multiple cores (producer-consumer queues,
   atomic counters) will see high epoch-sync overhead.

3. **No DMA coherence**: Device DMA (if we add a virtual disk controller)
   writes directly to BSP memory. AP cores won't see DMA writes until
   the coherence protocol propagates them. This is a non-issue for our current
   architecture (BSP handles all device I/O).

4. **JIT code cache is per-DO**: Each core compiles its own JIT code. No
   sharing of compiled code between cores. This wastes memory but avoids
   complexity.

5. **TSC drift**: Even with TSC offset synchronization, AP TSCs will drift
   from BSP over time. This can cause issues with Linux's clocksource
   calibration. Mitigation: periodic TSC re-sync at epoch boundaries.

---

## 15. Appendix: Key Data Structures

### 15.1 EpochBatch (Core → Coordinator)

```typescript
interface EpochBatch {
  epoch: number;                          // Monotonic epoch counter
  coreId: number;                         // Requesting core APIC ID

  // Pages this core needs (coherence faults during epoch)
  fetches: number[];                      // GPAs (page-aligned)

  // Pages this core wants to upgrade SHARED → EXCLUSIVE
  upgrades: number[];                     // GPAs (page-aligned)

  // Diffs for MODIFIED pages (byte-level changes since epoch start)
  diffs: Array<{
    gpa: number;                          // Page GPA
    data: ArrayBuffer;                    // RLE-encoded diff
  }>;

  // Outbound IPIs detected during epoch
  ipis: IPIMessage[];

  // Speculative reads (for validation)
  speculativeReads?: number[];            // GPAs read speculatively

  // Prefetch hints
  prefetchHints?: number[];               // GPAs to prefetch
}
```

### 15.2 EpochResponse (Coordinator → Core)

```typescript
interface EpochResponse {
  // Fetched page data (response to fetches + prefetches)
  pages: Array<{
    gpa: number;
    data: ArrayBuffer;                    // Full 4 KB page
    state: 'shared' | 'exclusive';        // Granted coherence state
  }>;

  // Pages invalidated by other cores during this epoch
  invalidations: number[];                // GPAs to invalidate locally

  // Upgrade confirmations
  grantedUpgrades: number[];              // GPAs successfully upgraded

  // Inbound IPIs for this core
  ipis: IPIMessage[];

  // Speculative validation result
  speculativeConflicts?: number[];        // GPAs that conflict with spec reads
}
```

### 15.3 WASM Coherence Map Layout

```
COHERENCE_MAP[65536]:  u8 per page  (256 KB)
  Index: GPA >> 12
  Values: 0=INVALID, 1=SHARED, 2=EXCLUSIVE, 3=MODIFIED

TWIN_MAP[65536]:  i32 per page  (256 KB)
  Index: GPA >> 12
  Values: twin pool index, or -1 (no twin)

TWIN_POOL[2048][4096]:  4 KB per twin  (8 MB)
  Pool of page snapshots for diffing
```

### 15.4 Coordinator Directory Entry

```typescript
interface DirEntry {
  state: 'uncached' | 'shared' | 'owned';
  owner: number;                    // APIC ID (-1 if not owned)
  sharers: Set<number>;             // APIC IDs with SHARED copies
  data: ArrayBuffer | null;         // Canonical 4 KB page data
  tier: 1 | 2 | 3;                 // Consistency tier
  accessCount: number;              // For tier promotion decisions
  lastModifiedEpoch: number;        // For conflict detection
}
```

---

*Document version: 1.0*
*Date: 2026-03-18*
*References: Ivy (Li & Hudak 1989), TreadMarks (Keleher et al. 1994),
Munin (Carter et al. 1991), Cloudflare Durable Objects documentation*
