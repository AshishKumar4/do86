# Distributed SMP: Each Durable Object is a CPU Core

## Overview

The world's first distributed x86 SMP computer running on edge compute. Each
CPU core is a separate Cloudflare Durable Object running its own v86 emulator
instance. Cores communicate via DO RPC for inter-processor interrupts and a
page-level memory coherence protocol.

```
Browser <--WebSocket--> CoordinatorDO
                          |-- env.CPU_CORE stubs --+
                          |                        |
                          +-- Core0 DO (BSP)       | shared memory
                          +-- Core1 DO (AP)        | pages via RPC
                          +-- Core2 DO (AP)        |
                          +-- ...                  |
                          |                        |
                          +-- IOAPIC routing       |
                          +-- Page directory (Map)  +
```

## Architecture

### DO Classes

| Class           | Binding          | Role                                                |
|-----------------|------------------|-----------------------------------------------------|
| `CoordinatorDO` | `COORDINATOR`    | Browser-facing. WebSocket hub, IOAPIC, page oracle. |
| `CpuCoreDO`     | `CPU_CORE`       | Per-core v86 instance. LAPIC, TLB, execution.       |

One `CoordinatorDO` per VM session. N `CpuCoreDO` instances per VM (one per
emulated core). All created with `locationHint` matching the coordinator so
they land in the same data center for minimal RPC latency.

### Why DOs Instead of Worker Loader

The `cloudflare-parallel` library uses Worker Loader to spawn ephemeral
isolates for stateless parallel compute. CPU cores are the opposite: they are
long-lived, stateful actors that need:

- Persistent in-memory state (v86 emulator with ~64MB WASM memory)
- Bidirectional RPC (coordinator calls core, core calls coordinator)
- WebSocket forwarding (screen output from BSP core)
- Alarm-based idle eviction

Standard Durable Objects are the right primitive. Each core is an actor in the
actor-model sense: it has private mutable state (registers, TLB, local RAM
cache), receives messages (IPIs, page requests, input events), and sends
messages (page fetches, IPI delivery, screen frames).

---

## Memory Coherence Protocol

### Design: Coordinator-Owned Pages with Core Caching

Guest physical RAM is divided into 4KB pages (matching x86 page granularity).
The coordinator holds the **canonical copy** of every page. Cores maintain a
local cache of pages they have accessed.

This is a simplified directory-based coherence protocol, not MESI. Full MESI
with Exclusive/Modified tracking adds complexity that isn't justified at
millisecond-scale RPC latencies. Instead we use a simpler two-state model:

#### Page States (at the coordinator)

| State       | Meaning                                              |
|-------------|------------------------------------------------------|
| `CLEAN`     | Page data is in the canonical store. No core has a   |
|             | dirty copy. Any core can read it.                    |
| `OWNED(N)`  | Core N has the sole writable copy. Coordinator's     |
|             | copy is stale. Other cores must request from N.      |

#### Page States (at each core)

| State       | Meaning                                              |
|-------------|------------------------------------------------------|
| `ABSENT`    | Core does not have this page. Must fetch on access.  |
| `SHARED`    | Core has a read-only copy. Write requires upgrade.   |
| `WRITABLE`  | Core has the sole writable copy. Coordinator knows.  |

#### Operations

**Read miss** (core accesses page it doesn't have):
1. Core pauses v86 execution
2. Core RPCs coordinator: `fetchPage(physAddr)`
3. Coordinator checks state:
   - `CLEAN` → returns page data, core gets `SHARED`
   - `OWNED(M)` → RPCs core M: `writeback(physAddr)` → core M sends dirty
     data, becomes `SHARED` → coordinator updates canonical, returns to
     requester as `SHARED`
4. Core injects page into v86 WASM linear memory, resumes

**Write to SHARED page** (write fault):
1. Core RPCs coordinator: `upgradePage(physAddr)`
2. Coordinator invalidates all other cores holding this page:
   RPCs each: `invalidatePage(physAddr)` → they drop their copy
3. Coordinator marks page `OWNED(N)`, responds OK
4. Core marks page `WRITABLE`, writes proceed

**Writeback** (triggered by coordinator on behalf of another core):
1. Coordinator RPCs owning core: `writeback(physAddr)`
2. Core extracts page from v86 WASM memory, sends to coordinator
3. Core marks page `SHARED`, coordinator marks `CLEAN`

### Optimization: Boot-Phase Bulk Ownership

During cold boot, only Core 0 (BSP) is running. All pages start as
`OWNED(0)` — zero RPC overhead. When Core 1 starts and accesses its first
page, the coherence protocol activates. Most kernel code pages are read-only
after boot, so they quickly settle into `SHARED` on both cores with no further
coherence traffic.

### Optimization: Code Page Detection

Pages containing executable code (detected via v86's TLB code flag or the
guest's page table NX bit) are almost always read-only. These are aggressively
cached as `SHARED` and never upgraded to `WRITABLE` unless a self-modifying
code pattern is detected.

### Optimization: Stack/Heap Locality

AqeousOS assigns per-core stacks and per-core scheduler data. Pages touched
only by one core stay `OWNED(N)` permanently — zero coherence overhead. The
coordinator tracks access patterns and avoids unnecessary invalidations.

### Page Fetch Mechanism

v86 emulates x86 with a software TLB. We intercept at the TLB miss level:

1. v86's `do_page_translation()` is called when a guest virtual address has
   no TLB entry
2. If the physical page is `ABSENT` in the core's local cache, we trigger a
   **page fault to the coordinator** (async RPC)
3. The coordinator returns the page data
4. The core writes it into v86's WASM linear memory at the appropriate
   physical address
5. v86's TLB is populated and execution resumes

**Implementation**: We patch v86's memory read/write handlers to check a local
`PageState` map. On miss, we yield to JS (via the existing `main_loop()`
return mechanism), make the RPC call, populate memory, and resume.

---

## Inter-Processor Interrupts (IPI)

### LAPIC ICR Interception

v86 already emulates the LAPIC. When guest code writes to the ICR register
at `0xFEE00300`, v86's `apic.rs` processes it. Currently, `route()` ignores
the destination and delivers to self. We modify this:

1. **In v86 JS wrapper**: After each `main_loop()` cycle, check if the LAPIC
   wrote to ICR during execution. If so, extract:
   - `destination` (APIC ID of target core)
   - `vector` (interrupt vector number)
   - `delivery_mode` (Fixed=0, INIT=5, SIPI=6)
   - `destination_shorthand` (0=none, 1=self, 2=all-incl-self, 3=all-but-self)

2. **RPC to coordinator**: `deliverIPI({ from, to, vector, mode })`

3. **Coordinator routes**: Looks up which `CpuCoreDO` owns the target APIC ID,
   RPCs it: `injectInterrupt({ vector, mode })`

4. **Target core injects**: Sets the appropriate bit in v86's LAPIC IRR
   (Interrupt Request Register) via direct WASM memory write. On next
   `main_loop()` cycle, v86's `handle_irqs()` picks it up.

### Delivery Modes

| Mode  | Name  | Action at Target Core                                  |
|-------|-------|--------------------------------------------------------|
| 0     | Fixed | Set IRR bit for `vector`. Normal interrupt delivery.   |
| 5     | INIT  | Reset CPU state (registers, IP=0, real mode).          |
| 6     | SIPI  | Set IP to `vector * 0x1000`, mark core as started.     |
| 2     | SMI   | Ignored (no SMM in v86).                               |
| 4     | NMI   | Inject NMI (vector 2).                                 |

### Boot Sequence (INIT + SIPI)

AqeousOS's `BootAPs()` sends INIT then SIPI to each AP:

1. BSP writes `0x00004500` to ICR → INIT to target
2. BSP writes `0x00004600 | vector` to ICR → SIPI to target

Our interception:

1. **INIT IPI captured** → Coordinator RPCs Core N: `initReset()`
   - Core N resets its v86 instance (or creates it fresh)
   - Core N enters halted state, waiting for SIPI

2. **SIPI captured** → Coordinator RPCs Core N: `startupIPI(vector)`
   - Core N sets instruction pointer to `vector * 0x1000`
   - Core N copies the AP trampoline code from BSP's memory (via page fetch)
   - Core N starts executing (runs `main_loop()` in a timer loop)

### IOAPIC (External Interrupts)

The IOAPIC lives in the coordinator. When a device raises an interrupt:

1. Keyboard IRQ → coordinator receives it (from the BSP's v86 or from a
   browser keyboard event)
2. Coordinator reads the IOAPIC redirection table (maintained in coordinator
   memory, matching v86's IOAPIC state)
3. Routes to the target core based on the redirection entry's destination
   APIC ID
4. RPCs target core: `injectInterrupt({ vector })`

In practice, AqeousOS routes keyboard/PIT through PIC to BSP only, and uses
IOAPIC entries 18-20 for scheduler vectors. So external interrupts mostly
stay on Core 0.

---

## Core Lifecycle

### States

```
IDLE → CREATING → WAITING_FOR_SIPI → RUNNING → HALTED → RUNNING → ...
                                                   ↓
                                               EVICTED (DO hibernates)
```

### Creation Flow

1. Coordinator receives `createCore(apicId)` call
2. Creates a `CpuCoreDO` stub:
   ```ts
   const id = env.CPU_CORE.idFromName(`vm-${vmId}-core-${apicId}`);
   const stub = env.CPU_CORE.get(id, { locationHint: this.location });
   ```
3. RPCs the new core: `init({ apicId, biosAssets, memorySize })`
4. Core creates a v86 instance but does NOT start executing
5. Core enters `WAITING_FOR_SIPI` state

### Execution Model

Each `CpuCoreDO` runs v86 in a cooperative loop using `setInterval`:

```ts
private executionTimer: ReturnType<typeof setInterval> | null = null;

startExecution() {
  this.executionTimer = setInterval(() => {
    // Run v86 for one frame (~1ms of guest time)
    const sleepTime = this.emulator.main_loop();

    // Check for outbound IPIs
    this.drainIPIQueue();

    // Check for pending page faults
    this.processPendingPageFaults();
  }, 0); // Run as fast as possible
}
```

### Screen Output

Only the BSP (Core 0) has VGA. The coordinator proxies the BSP's screen
frames to connected browsers, exactly as `LinuxVM` does today. AP cores have
no VGA — they're headless.

---

## Coordinator Architecture

### State

```ts
class CoordinatorDO extends DurableObject {
  // VM identity
  private vmId: string;
  private numCores: number;

  // Core stubs (kept alive for RPC)
  private cores: Map<number, DurableObjectStub>;  // apicId → stub

  // Page directory: canonical memory + ownership
  private pageDir: PageDirectory;

  // IOAPIC state (24 redirection entries)
  private ioapicRedirTable: Uint32Array;

  // Browser sessions
  private sessions: Map<WebSocket, ClientState>;

  // Boot assets (BIOS, disk, etc.)
  private bootAssets: Map<string, ArrayBuffer>;
}
```

### RPC Methods (called by cores)

```ts
// Memory coherence
async fetchPage(physAddr: number): Promise<ArrayBuffer>
async upgradePage(coreId: number, physAddr: number): Promise<void>
async writebackPage(coreId: number, physAddr: number, data: ArrayBuffer): Promise<void>

// IPI routing
async deliverIPI(from: number, to: number, vector: number, mode: number): Promise<void>

// Screen forwarding (BSP only)
async pushFrame(frameData: ArrayBuffer): Promise<void>

// IOAPIC
async routeExternalIRQ(irqLine: number): Promise<void>
```

### RPC Methods (called by coordinator on cores)

```ts
// Memory coherence
async invalidatePage(physAddr: number): Promise<void>
async writeback(physAddr: number): Promise<ArrayBuffer>

// IPI injection
async injectInterrupt(vector: number, mode: number): Promise<void>
async initReset(): Promise<void>
async startupIPI(vector: number): Promise<void>

// Lifecycle
async init(config: CoreConfig): Promise<void>
async start(): Promise<void>
async stop(): Promise<void>
```

---

## Performance Analysis

### Latency Budget

| Operation              | Real Hardware  | Distributed DO  | Slowdown |
|------------------------|---------------|-----------------|----------|
| Register access        | ~1 ns         | 0 (local v86)   | 1x       |
| L1 cache hit           | ~1 ns         | 0 (local WASM)  | 1x       |
| Local RAM access       | ~100 ns       | 0 (local page)  | 1x       |
| Page miss (cold)       | ~100 ns       | ~2-10 ms (RPC)  | ~50000x  |
| Page miss (co-located) | ~100 ns       | ~0.5-2 ms       | ~10000x  |
| IPI delivery           | ~1 us         | ~2-10 ms (RPC)  | ~5000x   |
| TLB shootdown          | ~10 us        | ~5-20 ms (RPC)  | ~1000x   |

### Why This Can Still Work

1. **Boot is single-core**: 99% of pages get populated by Core 0 during boot.
   By the time Core 1 starts, all kernel code is in the coordinator's
   canonical store. Core 1's first fetch of each code page is one RPC; after
   that, it's locally cached.

2. **Core-local operations dominate**: Each core runs its own scheduler,
   processes its own syscalls, manages its own task queues. These touch only
   core-local pages (per-core stacks, per-core scheduler state). Zero
   coherence overhead.

3. **AqeousOS's SMP is simple**: No complex shared data structures. The
   kernel uses IPIs mainly for scheduler balancing, which is infrequent.
   There's no heavy lock contention.

4. **v86 is already slow**: v86 runs at ~50 MIPS vs real x86 at ~5000 MIPS.
   The guest already experiences 100x slowdown. Adding 2-10ms page faults
   on the first access of each page is a one-time cost that's amortized
   over thousands of subsequent accesses.

5. **Prefetching**: On SIPI, the coordinator can proactively push the AP
   trampoline code pages (the first 1MB of memory) to the new core, so the
   AP starts with a warm cache.

### Estimated Costs

- 2-core VM running for 1 hour:
  - 3 DOs active (coordinator + 2 cores)
  - ~3 GB-s × 3600 = ~10,800 GB-s duration
  - ~1000 RPC calls for page coherence + IPIs during boot
  - ~100 RPC calls/minute steady-state
  - Cost: ~$0.14/hour (duration) + ~$0.01 (requests) = ~$0.15/hour

---

## Implementation Plan

### Phase 1: Skeleton (This PR)

- [x] Design document
- [ ] `src/coordinator-do.ts` — CoordinatorDO class with:
  - WebSocket handling (reuse from LinuxVM)
  - Core stub management
  - Basic page directory (in-memory Map)
  - IPI routing
- [ ] `src/core-do.ts` — CpuCoreDO class with:
  - v86 instance lifecycle
  - RPC methods for IPI injection
  - Page fault handler (RPC to coordinator)
  - Execution loop
- [ ] `src/memory-coherence.ts` — PageDirectory + PageCache classes
- [ ] `src/ipi-handler.ts` — IPI routing logic + IOAPIC state
- [ ] Updated `wrangler.jsonc` with new DO bindings
- [ ] Updated `src/index.ts` with new routing

### Phase 2: Single-Core Parity

- Boot AqeousOS on Core 0 via CoordinatorDO (same as current LinuxVM but
  routed through coordinator)
- Screen output works
- Keyboard input works
- No AP cores yet

### Phase 3: AP Boot

- Revert `has_apic = 0` hack in AqeousOS kernel
- Intercept ICR writes in v86 JS wrapper
- INIT/SIPI → coordinator → creates Core 1 DO → starts execution
- Core 1 fetches trampoline pages from coordinator
- Core 1 enters protected mode, loads GDT/IDT
- Verify: AqeousOS detects 2 cores, both reach idle

### Phase 4: Memory Coherence

- Implement page fault interception in v86
- Core 1 accesses shared kernel data → page fetch from coordinator
- Write tracking: detect writes to SHARED pages
- Invalidation protocol: coordinator notifies all sharers
- Verify: both cores can read/write shared memory correctly

### Phase 5: Scheduler Integration

- APIC timer on each core (v86 already supports this)
- Context switches happen independently on each core
- SAS (Scheduler Assistance System) uses IPIs for load balancing
- Verify: tasks get distributed across cores

---

## Open Questions

1. **v86 ICR interception**: Can we hook ICR writes from JS without modifying
   v86's Rust/WASM? Options:
   - (a) Poll LAPIC ICR register after each `main_loop()` call
   - (b) Patch v86 WASM to export ICR write events
   - (c) Intercept MMIO writes to 0xFEE00300 in JS memory handler

2. **Page fault granularity**: Should we intercept at 4KB page level or
   larger (64KB superpages)? Larger pages = fewer RPCs but more data per RPC.

3. **WASM memory sharing**: Each core's v86 has its own WASM linear memory.
   We need to copy pages between them via ArrayBuffer over RPC. The
   serialization overhead of 4KB pages is ~0.

4. **TSC synchronization**: Each core's TSC (Time Stamp Counter) should be
   roughly synchronized. v86's TSC is driven by wall-clock time, so cores
   in the same data center should be naturally close.

5. **ACPI/MADT patching**: SeaBIOS in v86 generates MADT with 1 CPU entry.
   We need to either: (a) patch SeaBIOS to report N CPUs, (b) have the
   kernel's MADT parser detect cores via a custom mechanism, or (c) modify
   the MADT in memory after BIOS runs. Option (b) is simplest for AqeousOS
   since we control the kernel.
