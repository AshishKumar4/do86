/**
 * ipi-handler.ts — Inter-Processor Interrupt routing + IOAPIC state.
 *
 * Handles IPI delivery between cores and external interrupt routing
 * via the IOAPIC redirection table.
 */

// ── IPI Delivery Modes (x86 LAPIC) ──────────────────────────────────────────

export const enum DeliveryMode {
  FIXED = 0,
  LOWEST_PRIORITY = 1,
  SMI = 2,
  NMI = 4,
  INIT = 5,
  SIPI = 6,
  EXTINT = 7,
}

export const enum DestinationShorthand {
  NONE = 0,
  SELF = 1,
  ALL_INCLUDING_SELF = 2,
  ALL_EXCLUDING_SELF = 3,
}

// ── IPI Message ──────────────────────────────────────────────────────────────

export interface IPIMessage {
  /** Source APIC ID. */
  from: number;
  /** Destination APIC ID (-1 for broadcast). */
  to: number;
  /** Interrupt vector (0-255). */
  vector: number;
  /** Delivery mode. */
  mode: DeliveryMode;
  /** Level: true = assert, false = deassert. */
  level: boolean;
  /** Trigger mode: true = level, false = edge. */
  triggerMode: boolean;
}

/**
 * Decode an ICR write into an IPI message.
 *
 * The LAPIC ICR is at MMIO 0xFEE00300 (low) and 0xFEE00310 (high).
 * - ICR Low (0x300): vector[7:0], delivery_mode[10:8], dest_mode[11],
 *   delivery_status[12], level[14], trigger[15], shorthand[19:18]
 * - ICR High (0x310): destination[31:24]
 */
export function decodeICR(icrLow: number, icrHigh: number, fromApicId: number): IPIMessage {
  const vector = icrLow & 0xFF;
  const mode = ((icrLow >> 8) & 0x7) as DeliveryMode;
  const level = !!(icrLow & (1 << 14));
  const triggerMode = !!(icrLow & (1 << 15));
  const shorthand = (icrLow >> 18) & 0x3;
  const destApicId = (icrHigh >> 24) & 0xFF;

  let to: number;
  switch (shorthand) {
    case DestinationShorthand.SELF:
      to = fromApicId;
      break;
    case DestinationShorthand.ALL_INCLUDING_SELF:
      to = -2; // Special: all cores including sender
      break;
    case DestinationShorthand.ALL_EXCLUDING_SELF:
      to = -3; // Special: all cores excluding sender
      break;
    default: // NONE
      to = destApicId;
      break;
  }

  return { from: fromApicId, to, vector, mode, level, triggerMode };
}

// ── IPI Router ───────────────────────────────────────────────────────────────

export type IPIDeliveryFn = (targetApicId: number, ipi: IPIMessage) => Promise<void>;

/**
 * IPIRouter — lives in the CoordinatorDO.
 *
 * Routes IPIs from source core to target core(s). Handles broadcast
 * shortcuts and the INIT/SIPI boot protocol.
 */
export class IPIRouter {
  private knownCores: Set<number> = new Set();
  private deliverFn: IPIDeliveryFn;

  /** Cores waiting for SIPI (after receiving INIT). */
  private waitingForSipi: Set<number> = new Set();

  /** Callback when a new core needs to be created (INIT to unknown core). */
  onCoreCreate: ((apicId: number) => Promise<void>) | null = null;

  /** Callback when a core receives SIPI (needs to start execution). */
  onCoreSIPI: ((apicId: number, vector: number) => Promise<void>) | null = null;

  constructor(deliverFn: IPIDeliveryFn) {
    this.deliverFn = deliverFn;
  }

  /** Register a core as known/active. */
  registerCore(apicId: number): void {
    this.knownCores.add(apicId);
  }

  /** Unregister a core. */
  unregisterCore(apicId: number): void {
    this.knownCores.delete(apicId);
    this.waitingForSipi.delete(apicId);
  }

  /** Route an IPI from a core. */
  async route(ipi: IPIMessage): Promise<void> {
    // Handle INIT/SIPI specially — these are the AP boot protocol
    if (ipi.mode === DeliveryMode.INIT) {
      await this.handleINIT(ipi);
      return;
    }

    if (ipi.mode === DeliveryMode.SIPI) {
      await this.handleSIPI(ipi);
      return;
    }

    // Standard IPI delivery
    const targets = this.resolveTargets(ipi);
    await Promise.all(targets.map((t) => this.deliverFn(t, ipi)));
  }

  /** Resolve which cores an IPI should be delivered to. */
  private resolveTargets(ipi: IPIMessage): number[] {
    if (ipi.to === -2) {
      // ALL_INCLUDING_SELF
      return [...this.knownCores];
    }
    if (ipi.to === -3) {
      // ALL_EXCLUDING_SELF
      return [...this.knownCores].filter((id) => id !== ipi.from);
    }
    if (ipi.to >= 0 && this.knownCores.has(ipi.to)) {
      return [ipi.to];
    }
    // Unknown target — IPI lost (normal for single-core)
    return [];
  }

  /** Handle INIT IPI — resets target core, prepares for SIPI. */
  private async handleINIT(ipi: IPIMessage): Promise<void> {
    const targets = this.resolveTargets(ipi);
    for (const targetId of targets) {
      if (targetId === ipi.from) continue; // INIT to self is unusual, skip

      if (!this.knownCores.has(targetId)) {
        // Core doesn't exist yet — create it
        if (this.onCoreCreate) {
          await this.onCoreCreate(targetId);
          this.knownCores.add(targetId);
        }
      }

      // Mark core as waiting for SIPI
      this.waitingForSipi.add(targetId);

      // Deliver INIT to the core (resets CPU state)
      await this.deliverFn(targetId, ipi);
    }
  }

  /** Handle Startup IPI — starts AP execution at vector*0x1000. */
  private async handleSIPI(ipi: IPIMessage): Promise<void> {
    const targets = this.resolveTargets(ipi);
    for (const targetId of targets) {
      if (!this.waitingForSipi.has(targetId)) {
        continue; // Ignore SIPI if core hasn't received INIT first
      }

      this.waitingForSipi.delete(targetId);

      // Notify coordinator to actually start the core
      if (this.onCoreSIPI) {
        await this.onCoreSIPI(targetId, ipi.vector);
      }
    }
  }

  get stats(): { knownCores: number; waitingForSipi: number } {
    return {
      knownCores: this.knownCores.size,
      waitingForSipi: this.waitingForSipi.size,
    };
  }
}

// ── IOAPIC ───────────────────────────────────────────────────────────────────

/** A single IOAPIC redirection table entry (64 bits). */
export interface IOAPICRedirEntry {
  vector: number;        // bits 7:0
  deliveryMode: number;  // bits 10:8
  destMode: number;      // bit 11 (0=physical, 1=logical)
  polarity: number;      // bit 13
  triggerMode: number;   // bit 15 (0=edge, 1=level)
  masked: boolean;       // bit 16
  destination: number;   // bits 63:56 (APIC ID in physical mode)
}

/**
 * IOAPIC — lives in the CoordinatorDO.
 *
 * Maintains the 24-entry redirection table. When a device raises an IRQ,
 * the coordinator looks up the routing and delivers to the target core.
 */
export class IOAPIC {
  private entries: IOAPICRedirEntry[] = [];
  private deliverFn: IPIDeliveryFn;

  constructor(numEntries: number, deliverFn: IPIDeliveryFn) {
    this.deliverFn = deliverFn;
    // Initialize all entries as masked
    for (let i = 0; i < numEntries; i++) {
      this.entries.push({
        vector: 0x20 + i, // Default vectors starting at 32
        deliveryMode: 0,  // Fixed
        destMode: 0,      // Physical
        polarity: 0,
        triggerMode: 0,   // Edge
        masked: true,
        destination: 0,
      });
    }
  }

  /** Update a redirection table entry (called when guest writes IOAPIC). */
  setEntry(index: number, low: number, high: number): void {
    if (index >= this.entries.length) return;
    const entry = this.entries[index];
    entry.vector = low & 0xFF;
    entry.deliveryMode = (low >> 8) & 0x7;
    entry.destMode = (low >> 11) & 0x1;
    entry.polarity = (low >> 13) & 0x1;
    entry.triggerMode = (low >> 15) & 0x1;
    entry.masked = !!(low & (1 << 16));
    entry.destination = (high >> 24) & 0xFF;
  }

  /** Read a redirection table entry. */
  getEntry(index: number): { low: number; high: number } | null {
    if (index >= this.entries.length) return null;
    const e = this.entries[index];
    const low =
      (e.vector & 0xFF) |
      ((e.deliveryMode & 0x7) << 8) |
      ((e.destMode & 0x1) << 11) |
      ((e.polarity & 0x1) << 13) |
      ((e.triggerMode & 0x1) << 15) |
      (e.masked ? (1 << 16) : 0);
    const high = (e.destination & 0xFF) << 24;
    return { low, high };
  }

  /** Route an external device IRQ to the appropriate core. */
  async routeIRQ(irqLine: number, fromApicId: number = 0): Promise<void> {
    if (irqLine >= this.entries.length) return;
    const entry = this.entries[irqLine];
    if (entry.masked) return;

    const ipi: IPIMessage = {
      from: fromApicId,
      to: entry.destination,
      vector: entry.vector,
      mode: entry.deliveryMode as DeliveryMode,
      level: entry.triggerMode === 1,
      triggerMode: entry.triggerMode === 1,
    };

    await this.deliverFn(entry.destination, ipi);
  }
}
