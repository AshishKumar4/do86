/**
 * AHCI MSI (Message Signaled Interrupts) Support
 * 
 * This module implements MSI and MSI-X interrupt support for AHCI,
 * integrating with the enhanced APIC system from Phase 2.
 */

import { LOG_DISK } from "./const.js";
import { h } from "./lib.js";
import { dbg_assert, dbg_log } from "./log.js";

// MSI Capability Structure offsets (in PCI config space)
export const MSI_CAP_ID = 0x05;
export const MSIX_CAP_ID = 0x11;

// MSI Control register bits
export const MSI_ENABLE = (1 << 0);
export const MSI_MULTIPLE_MSG_CAP_MASK = 0x0E;
export const MSI_MULTIPLE_MSG_CAP_SHIFT = 1;
export const MSI_MULTIPLE_MSG_EN_MASK = 0x70;
export const MSI_MULTIPLE_MSG_EN_SHIFT = 4;
export const MSI_64BIT_ADDR_CAP = (1 << 7);
export const MSI_PER_VECTOR_MASK_CAP = (1 << 8);

// MSI-X Control register bits
export const MSIX_ENABLE = (1 << 15);
export const MSIX_FUNCTION_MASK = (1 << 14);
export const MSIX_TABLE_SIZE_MASK = 0x7FF;

// AHCI Interrupt vectors
export const AHCI_IRQ_PORT_BASE = 0x30;      // Base vector for port interrupts
export const AHCI_IRQ_GLOBAL = 0x38;        // Global AHCI interrupt
export const AHCI_IRQ_ERROR = 0x39;         // AHCI error interrupt
export const AHCI_IRQ_HOT_PLUG = 0x3A;      // Hot plug interrupt

/**
 * MSI Table Entry (16 bytes each for MSI-X)
 */
export class MSIXTableEntry {
    constructor(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }
    
    // Message Address (64-bit)
    get message_addr() {
        const low = this.buffer[this.offset + 0] |
                   (this.buffer[this.offset + 1] << 8) |
                   (this.buffer[this.offset + 2] << 16) |
                   (this.buffer[this.offset + 3] << 24);
        const high = this.buffer[this.offset + 4] |
                    (this.buffer[this.offset + 5] << 8) |
                    (this.buffer[this.offset + 6] << 16) |
                    (this.buffer[this.offset + 7] << 24);
        return { low, high };
    }
    
    set message_addr(value) {
        this.buffer[this.offset + 0] = value.low & 0xFF;
        this.buffer[this.offset + 1] = (value.low >> 8) & 0xFF;
        this.buffer[this.offset + 2] = (value.low >> 16) & 0xFF;
        this.buffer[this.offset + 3] = (value.low >> 24) & 0xFF;
        this.buffer[this.offset + 4] = value.high & 0xFF;
        this.buffer[this.offset + 5] = (value.high >> 8) & 0xFF;
        this.buffer[this.offset + 6] = (value.high >> 16) & 0xFF;
        this.buffer[this.offset + 7] = (value.high >> 24) & 0xFF;
    }
    
    // Message Data (32-bit)
    get message_data() {
        return this.buffer[this.offset + 8] |
               (this.buffer[this.offset + 9] << 8) |
               (this.buffer[this.offset + 10] << 16) |
               (this.buffer[this.offset + 11] << 24);
    }
    
    set message_data(value) {
        this.buffer[this.offset + 8] = value & 0xFF;
        this.buffer[this.offset + 9] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 10] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 11] = (value >> 24) & 0xFF;
    }
    
    // Vector Control (32-bit)
    get vector_control() {
        return this.buffer[this.offset + 12] |
               (this.buffer[this.offset + 13] << 8) |
               (this.buffer[this.offset + 14] << 16) |
               (this.buffer[this.offset + 15] << 24);
    }
    
    set vector_control(value) {
        this.buffer[this.offset + 12] = value & 0xFF;
        this.buffer[this.offset + 13] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 14] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 15] = (value >> 24) & 0xFF;
    }
    
    // Check if vector is masked
    get is_masked() {
        return !!(this.vector_control & 1);
    }
    
    set is_masked(value) {
        if (value) {
            this.vector_control |= 1;
        } else {
            this.vector_control &= ~1;
        }
    }
}

/**
 * AHCI MSI Manager
 * 
 * Handles MSI and MSI-X interrupt configuration and delivery
 */
export class AHCIMSIManager {
    constructor(controller) {
        this.controller = controller;
        this.cpu = controller.cpu;
        
        // MSI configuration
        this.msi_enabled = false;
        this.msi_addr = 0;
        this.msi_data = 0;
        this.msi_mask = 0;
        this.msi_pending = 0;
        this.msi_multiple_msg_enable = 0;
        
        // MSI-X configuration
        this.msix_enabled = false;
        this.msix_function_mask = false;
        this.msix_table = null;
        this.msix_pba = null;  // Pending Bit Array
        this.msix_table_size = 8;  // 8 vectors for AHCI
        
        this.init_msi_table();
        
        dbg_log("AHCI MSI Manager initialized", LOG_DISK);
    }
    
    /**
     * Initialize MSI-X table with default values
     */
    init_msi_table() {
        // Allocate MSI-X table (8 entries × 16 bytes = 128 bytes)
        this.msix_table = new Uint8Array(this.msix_table_size * 16);
        this.msix_pba = new Uint32Array(Math.ceil(this.msix_table_size / 32));
        
        // Initialize each table entry
        for (let i = 0; i < this.msix_table_size; i++) {
            const entry = new MSIXTableEntry(this.msix_table, i * 16);
            
            // Default to local APIC address for CPU 0
            entry.message_addr = { low: 0xFEE00000, high: 0 };
            
            // Default message data with vector
            entry.message_data = AHCI_IRQ_PORT_BASE + i;
            
            // Mask by default
            entry.is_masked = true;
        }
        
        dbg_log("AHCI MSI: Initialized MSI-X table with " + this.msix_table_size + " entries", LOG_DISK);
    }
    
    /**
     * Enable MSI interrupts
     * @param {number} addr - MSI message address
     * @param {number} data - MSI message data
     */
    enable_msi(addr, data) {
        this.msi_enabled = true;
        this.msi_addr = addr;
        this.msi_data = data;
        
        dbg_log("AHCI MSI: MSI enabled, addr=" + h(addr) + " data=" + h(data), LOG_DISK);
    }
    
    /**
     * Disable MSI interrupts
     */
    disable_msi() {
        this.msi_enabled = false;
        dbg_log("AHCI MSI: MSI disabled", LOG_DISK);
    }
    
    /**
     * Enable MSI-X interrupts
     */
    enable_msix() {
        this.msix_enabled = true;
        this.msix_function_mask = false;
        
        // Unmask default vectors
        this.unmask_msix_vector(0);  // Port 0 interrupt
        
        dbg_log("AHCI MSI: MSI-X enabled", LOG_DISK);
    }
    
    /**
     * Disable MSI-X interrupts
     */
    disable_msix() {
        this.msix_enabled = false;
        dbg_log("AHCI MSI: MSI-X disabled", LOG_DISK);
    }
    
    /**
     * Configure MSI-X vector for a specific port
     * @param {number} port - Port number
     * @param {number} cpu_id - Target CPU ID
     * @param {number} vector - Interrupt vector
     */
    configure_port_vector(port, cpu_id, vector = null) {
        if (port >= this.msix_table_size) {
            dbg_log("AHCI MSI: Invalid port " + port + " for MSI-X configuration", LOG_DISK);
            return;
        }
        
        const entry = new MSIXTableEntry(this.msix_table, port * 16);
        
        // Calculate local APIC address for target CPU
        const apic_addr = 0xFEE00000 | (cpu_id << 12);  // Each CPU has its own APIC
        entry.message_addr = { low: apic_addr, high: 0 };
        
        // Set vector (default to port-specific vector)
        const irq_vector = vector || (AHCI_IRQ_PORT_BASE + port);
        entry.message_data = irq_vector | (0 << 8);  // Fixed delivery mode
        
        // Unmask the vector
        entry.is_masked = false;
        
        dbg_log("AHCI MSI: Configured port " + port + " vector " + h(irq_vector) + 
               " for CPU " + cpu_id + " at APIC " + h(apic_addr), LOG_DISK);
    }
    
    /**
     * Mask MSI-X vector
     * @param {number} vector_index - Vector index in table
     */
    mask_msix_vector(vector_index) {
        if (vector_index >= this.msix_table_size) return;
        
        const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
        entry.is_masked = true;
        
        dbg_log("AHCI MSI: Masked vector " + vector_index, LOG_DISK);
    }
    
    /**
     * Unmask MSI-X vector
     * @param {number} vector_index - Vector index in table
     */
    unmask_msix_vector(vector_index) {
        if (vector_index >= this.msix_table_size) return;
        
        const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
        entry.is_masked = false;
        
        // If there's a pending interrupt for this vector, deliver it now
        this.check_pending_msix_interrupt(vector_index);
        
        dbg_log("AHCI MSI: Unmasked vector " + vector_index, LOG_DISK);
    }
    
    /**
     * Deliver MSI interrupt for a specific port
     * @param {number} port - Port number
     * @param {number} interrupt_type - Type of interrupt
     */
    deliver_port_interrupt(port, interrupt_type = 0) {
        if (this.msix_enabled && !this.msix_function_mask) {
            this.deliver_msix_interrupt(port, interrupt_type);
        } else if (this.msi_enabled) {
            this.deliver_msi_interrupt();
        } else {
            // Fall back to legacy PCI interrupt
            this.deliver_legacy_interrupt();
        }
    }
    
    /**
     * Deliver MSI-X interrupt
     * @param {number} vector_index - Vector index
     * @param {number} interrupt_type - Interrupt type
     */
    deliver_msix_interrupt(vector_index, interrupt_type) {
        if (vector_index >= this.msix_table_size) {
            dbg_log("AHCI MSI: Invalid vector index " + vector_index, LOG_DISK);
            return;
        }
        
        const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
        
        if (entry.is_masked) {
            // Set pending bit
            const bit_index = vector_index % 32;
            const dword_index = Math.floor(vector_index / 32);
            this.msix_pba[dword_index] |= (1 << bit_index);
            
            dbg_log("AHCI MSI: Vector " + vector_index + " masked, setting pending bit", LOG_DISK);
            return;
        }
        
        const addr = entry.message_addr;
        const data = entry.message_data;
        
        // Extract target CPU from APIC address
        const target_cpu = (addr.low >> 12) & 0xFF;
        const vector = data & 0xFF;
        
        // Deliver interrupt via enhanced APIC system
        this.deliver_apic_interrupt(target_cpu, vector);
        
        dbg_log("AHCI MSI: Delivered MSI-X interrupt vector " + h(vector) + 
               " to CPU " + target_cpu, LOG_DISK);
    }
    
    /**
     * Deliver MSI interrupt
     */
    deliver_msi_interrupt() {
        if (!this.msi_enabled) return;
        
        // Extract target CPU from APIC address
        const target_cpu = (this.msi_addr >> 12) & 0xFF;
        const vector = this.msi_data & 0xFF;
        
        // Deliver interrupt via enhanced APIC system
        this.deliver_apic_interrupt(target_cpu, vector);
        
        dbg_log("AHCI MSI: Delivered MSI interrupt vector " + h(vector) + 
               " to CPU " + target_cpu, LOG_DISK);
    }
    
    /**
     * Deliver legacy PCI interrupt
     */
    deliver_legacy_interrupt() {
        // Use existing PCI interrupt mechanism
        if (this.cpu.devices && this.cpu.devices.pci) {
            this.cpu.devices.pci.raise_irq(this.controller.pci_id);
        }
        
        dbg_log("AHCI MSI: Delivered legacy PCI interrupt", LOG_DISK);
    }
    
    /**
     * Deliver interrupt via APIC system
     * @param {number} target_cpu - Target CPU ID
     * @param {number} vector - Interrupt vector
     */
    deliver_apic_interrupt(target_cpu, vector) {
        // This integrates with the enhanced APIC system from Phase 2
        // For now, simulate the delivery
        dbg_log("AHCI MSI: Delivering vector " + h(vector) + " to CPU " + target_cpu + " via APIC", LOG_DISK);
        
        // In a real implementation, this would use the enhanced APIC:
        // if (typeof ahci_deliver_msi_interrupt === 'function') {
        //     ahci_deliver_msi_interrupt(target_cpu, vector);
        // } else {
        //     // Fallback to legacy interrupt
        //     this.deliver_legacy_interrupt();
        // }
        
        // For now, fall back to legacy interrupt
        this.deliver_legacy_interrupt();
    }
    
    /**
     * Check for pending MSI-X interrupts after unmasking
     * @param {number} vector_index - Vector index that was unmasked
     */
    check_pending_msix_interrupt(vector_index) {
        const bit_index = vector_index % 32;
        const dword_index = Math.floor(vector_index / 32);
        
        if (this.msix_pba[dword_index] & (1 << bit_index)) {
            // Clear pending bit
            this.msix_pba[dword_index] &= ~(1 << bit_index);
            
            // Deliver the pending interrupt
            this.deliver_msix_interrupt(vector_index, 0);
        }
    }
    
    /**
     * Configure CPU affinity for AHCI interrupts
     * @param {Array<number>} cpu_map - Array mapping ports to CPUs
     */
    configure_cpu_affinity(cpu_map) {
        if (!this.msix_enabled) {
            dbg_log("AHCI MSI: Cannot configure CPU affinity without MSI-X", LOG_DISK);
            return;
        }
        
        for (let port = 0; port < Math.min(cpu_map.length, this.msix_table_size); port++) {
            const target_cpu = cpu_map[port];
            if (target_cpu >= 0 && target_cpu < 8) {  // Max 8 CPUs
                this.configure_port_vector(port, target_cpu);
            }
        }
        
        dbg_log("AHCI MSI: Configured CPU affinity: " + cpu_map.join(", "), LOG_DISK);
    }
    
    /**
     * Get MSI configuration for PCI config space
     */
    get_msi_config() {
        return {
            msi_enabled: this.msi_enabled,
            msi_addr: this.msi_addr,
            msi_data: this.msi_data,
            msi_mask: this.msi_mask,
            msi_pending: this.msi_pending,
            multiple_msg_enable: this.msi_multiple_msg_enable,
        };
    }
    
    /**
     * Get MSI-X configuration for PCI config space
     */
    get_msix_config() {
        return {
            msix_enabled: this.msix_enabled,
            function_mask: this.msix_function_mask,
            table_size: this.msix_table_size,
        };
    }
    
    /**
     * Get state for save/restore
     */
    get_state() {
        return {
            msi_enabled: this.msi_enabled,
            msi_addr: this.msi_addr,
            msi_data: this.msi_data,
            msi_mask: this.msi_mask,
            msi_pending: this.msi_pending,
            msi_multiple_msg_enable: this.msi_multiple_msg_enable,
            
            msix_enabled: this.msix_enabled,
            msix_function_mask: this.msix_function_mask,
            msix_table_size: this.msix_table_size,
            msix_table: Array.from(this.msix_table),
            msix_pba: Array.from(this.msix_pba),
        };
    }
    
    /**
     * Set state for save/restore
     */
    set_state(state) {
        this.msi_enabled = state.msi_enabled || false;
        this.msi_addr = state.msi_addr || 0;
        this.msi_data = state.msi_data || 0;
        this.msi_mask = state.msi_mask || 0;
        this.msi_pending = state.msi_pending || 0;
        this.msi_multiple_msg_enable = state.msi_multiple_msg_enable || 0;
        
        this.msix_enabled = state.msix_enabled || false;
        this.msix_function_mask = state.msix_function_mask || false;
        this.msix_table_size = state.msix_table_size || 8;
        
        if (state.msix_table) {
            this.msix_table = new Uint8Array(state.msix_table);
        }
        if (state.msix_pba) {
            this.msix_pba = new Uint32Array(state.msix_pba);
        }
    }
}

export { AHCIMSIManager };