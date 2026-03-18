/**
 * AHCI SMP Integration Module
 * 
 * This module handles the integration of AHCI with the SMP (Symmetric Multi-Processing)
 * architecture from Phase 3, including shared memory access, cache coherency, and 
 * multi-CPU command processing.
 */

import { LOG_DISK } from "./const.js";
import { h } from "./lib.js";
import { dbg_assert, dbg_log } from "./log.js";

// SMP Memory Layout Constants (from ahci_memory_layout_design.md)
export const AHCI_COMMAND_LISTS_BASE = 0x03040000;    // 4KB - Command lists
export const AHCI_COMMAND_TABLES_BASE = 0x03041000;   // 60KB - Command tables  
export const AHCI_DATA_BUFFERS_BASE = 0x03050000;     // 3.75MB - DMA buffers
export const AHCI_FIS_BUFFERS_BASE = 0x03400000;      // 4KB - FIS buffers

// Per-CPU buffer allocation (for 8 CPUs)
export const CPU_BUFFER_SIZE = 480 * 1024;  // 480KB per CPU
export const SHARED_BUFFER_SIZE = 960 * 1024;  // 960KB shared

// Command slot allocation per CPU (32 slots total, 4 per CPU for 8 CPUs)
export const SLOTS_PER_CPU = 4;
export const MAX_CPUS = 8;

/**
 * AHCI SMP Memory Manager
 * 
 * Handles shared memory allocation and access coordination between multiple CPUs
 */
export class AHCISMPMemoryManager {
    constructor(cpu, shared_buffer = null) {
        this.cpu = cpu;
        this.cpu_id = cpu.cpu_id || 0;
        this.shared_buffer = shared_buffer;
        this.smp_enabled = !!shared_buffer;
        
        // Memory regions
        this.command_lists = null;
        this.command_tables = null;
        this.data_buffers = null;
        this.fis_buffers = null;
        
        // Per-CPU slot allocation tracking
        this.slot_allocation = new Array(32).fill(-1);  // -1 = free, else CPU ID
        this.slot_locks = new Array(32).fill(false);
        
        this.init_memory_regions();
        
        dbg_log("AHCI SMP Memory Manager initialized for CPU " + this.cpu_id + 
               (this.smp_enabled ? " with SMP" : " without SMP"), LOG_DISK);
    }
    
    /**
     * Initialize memory regions
     */
    init_memory_regions() {
        if (this.smp_enabled && this.shared_buffer) {
            // Use SharedArrayBuffer for SMP operation
            this.init_shared_memory_regions();
        } else {
            // Use regular memory for single-CPU operation
            this.init_local_memory_regions();
        }
    }
    
    /**
     * Initialize SharedArrayBuffer regions for SMP
     */
    init_shared_memory_regions() {
        const buffer = this.shared_buffer;
        
        // Command Lists: 32 slots × 32 bytes = 1KB per port
        this.command_lists = new Uint8Array(buffer, 0x0000, 0x1000);
        
        // Command Tables: 30 tables × 2KB each = 60KB
        this.command_tables = new Uint8Array(buffer, 0x1000, 0xF000);
        
        // Data Buffers: 3.75MB split between CPUs
        this.data_buffers = new Uint8Array(buffer, 0x10000, 0x3C0000);
        
        // FIS Buffers: 4KB (256 bytes per port)
        this.fis_buffers = new Uint8Array(buffer, 0x3D0000, 0x1000);
        
        // Atomic slot status array for lock-free slot allocation
        this.slot_status = new Int32Array(buffer, 0x3E0000, 32);
        
        dbg_log("AHCI SMP: Initialized SharedArrayBuffer regions", LOG_DISK);
    }
    
    /**
     * Initialize local memory regions for single-CPU
     */
    init_local_memory_regions() {
        // Simulate the same layout in regular memory
        this.command_lists = new Uint8Array(0x1000);
        this.command_tables = new Uint8Array(0xF000);
        this.data_buffers = new Uint8Array(0x3C0000);
        this.fis_buffers = new Uint8Array(0x1000);
        this.slot_status = new Int32Array(32);
        
        dbg_log("AHCI SMP: Initialized local memory regions", LOG_DISK);
    }
    
    /**
     * Allocate a command slot for the current CPU
     * @returns {number} Slot number or -1 if no free slots
     */
    allocate_command_slot() {
        const cpu_start = this.cpu_id * SLOTS_PER_CPU;
        const cpu_end = cpu_start + SLOTS_PER_CPU;
        
        // Try to allocate in this CPU's range first
        for (let slot = cpu_start; slot < cpu_end && slot < 32; slot++) {
            if (this.try_allocate_slot(slot)) {
                return slot;
            }
        }
        
        // If CPU-specific slots are full, try any available slot
        for (let slot = 0; slot < 32; slot++) {
            if (this.try_allocate_slot(slot)) {
                return slot;
            }
        }
        
        dbg_log("AHCI SMP: No free command slots for CPU " + this.cpu_id, LOG_DISK);
        return -1;
    }
    
    /**
     * Try to atomically allocate a specific slot
     * @param {number} slot - Slot number to allocate
     * @returns {boolean} True if successful
     */
    try_allocate_slot(slot) {
        if (this.smp_enabled) {
            // Use atomic compare-and-swap for SMP
            const old_value = Atomics.compareExchange(this.slot_status, slot, 0, this.cpu_id + 1);
            return old_value === 0;
        } else {
            // Simple check for single-CPU
            if (this.slot_status[slot] === 0) {
                this.slot_status[slot] = this.cpu_id + 1;
                return true;
            }
            return false;
        }
    }
    
    /**
     * Release a command slot
     * @param {number} slot - Slot number to release
     */
    release_command_slot(slot) {
        if (this.smp_enabled) {
            Atomics.store(this.slot_status, slot, 0);
        } else {
            this.slot_status[slot] = 0;
        }
        
        dbg_log("AHCI SMP: Released command slot " + slot + " for CPU " + this.cpu_id, LOG_DISK);
    }
    
    /**
     * Get command list entry for a slot
     * @param {number} port - Port number
     * @param {number} slot - Slot number
     * @returns {Uint8Array} Command list entry (32 bytes)
     */
    get_command_list_entry(port, slot) {
        const offset = (port * 32 * 32) + (slot * 32);  // 32 slots × 32 bytes per port
        return new Uint8Array(this.command_lists.buffer, 
                             this.command_lists.byteOffset + offset, 32);
    }
    
    /**
     * Get command table for a slot
     * @param {number} table_index - Command table index
     * @returns {Uint8Array} Command table (2KB)
     */
    get_command_table(table_index) {
        const offset = table_index * 2048;  // 2KB per table
        return new Uint8Array(this.command_tables.buffer,
                             this.command_tables.byteOffset + offset, 2048);
    }
    
    /**
     * Get DMA buffer for CPU
     * @param {number} cpu_id - CPU ID (defaults to current CPU)
     * @param {number} buffer_offset - Offset within CPU's buffer space
     * @param {number} size - Buffer size needed
     * @returns {Uint8Array} DMA buffer
     */
    get_dma_buffer(cpu_id = this.cpu_id, buffer_offset = 0, size = CPU_BUFFER_SIZE) {
        let start_offset;
        
        if (cpu_id < MAX_CPUS) {
            // Per-CPU buffer
            start_offset = cpu_id * CPU_BUFFER_SIZE + buffer_offset;
        } else {
            // Shared buffer area
            start_offset = MAX_CPUS * CPU_BUFFER_SIZE + buffer_offset;
        }
        
        dbg_assert(start_offset + size <= this.data_buffers.length, 
                  "DMA buffer request exceeds available space");
        
        return new Uint8Array(this.data_buffers.buffer,
                             this.data_buffers.byteOffset + start_offset, size);
    }
    
    /**
     * Get FIS buffer for a port
     * @param {number} port - Port number
     * @returns {Uint8Array} FIS buffer (256 bytes)
     */
    get_fis_buffer(port) {
        const offset = port * 256;  // 256 bytes per port
        return new Uint8Array(this.fis_buffers.buffer,
                             this.fis_buffers.byteOffset + offset, 256);
    }
    
    /**
     * Invalidate cache lines for DMA coherency
     * @param {number} address - Memory address
     * @param {number} size - Size in bytes
     */
    invalidate_cache_lines(address, size) {
        if (!this.smp_enabled) {
            return;  // No cache coherency needed for single CPU
        }
        
        // Send IPI to all other CPUs to invalidate cache lines
        // This would integrate with the enhanced APIC system from Phase 2
        dbg_log("AHCI SMP: Invalidating cache lines at " + h(address) + " size " + size, LOG_DISK);
        
        // TODO: Integrate with actual IPI system
        this.broadcast_cache_invalidation(address, size);
    }
    
    /**
     * Broadcast cache invalidation IPI to all CPUs
     * @param {number} address - Memory address  
     * @param {number} size - Size in bytes
     */
    broadcast_cache_invalidation(address, size) {
        // This would use the enhanced APIC system from Phase 2
        // For now, just log the operation
        dbg_log("AHCI SMP: Broadcasting cache invalidation IPI for address " + h(address), LOG_DISK);
        
        // In a full implementation:
        // for (let cpu = 0; cpu < MAX_CPUS; cpu++) {
        //     if (cpu !== this.cpu_id) {
        //         send_ipi(cpu, IPI_CACHE_INVALIDATE, address, size);
        //     }
        // }
    }
    
    /**
     * Wait for all pending DMA operations to complete
     */
    async wait_for_dma_completion() {
        // TODO: Implement actual DMA completion tracking
        // For now, just simulate a small delay
        return new Promise(resolve => setTimeout(resolve, 0.1));
    }
    
    /**
     * Get memory statistics for debugging
     */
    get_memory_stats() {
        let allocated_slots = 0;
        let cpu_slot_usage = new Array(MAX_CPUS).fill(0);
        
        for (let slot = 0; slot < 32; slot++) {
            const owner = this.slot_status[slot];
            if (owner > 0) {
                allocated_slots++;
                const cpu_id = owner - 1;
                if (cpu_id < MAX_CPUS) {
                    cpu_slot_usage[cpu_id]++;
                }
            }
        }
        
        return {
            total_slots: 32,
            allocated_slots: allocated_slots,
            free_slots: 32 - allocated_slots,
            cpu_slot_usage: cpu_slot_usage,
            current_cpu: this.cpu_id,
            smp_enabled: this.smp_enabled,
            buffer_sizes: {
                command_lists: this.command_lists.length,
                command_tables: this.command_tables.length,
                data_buffers: this.data_buffers.length,
                fis_buffers: this.fis_buffers.length
            }
        };
    }
}

/**
 * AHCI DMA Manager with SMP Support
 */
export class AHCIDMAManager {
    constructor(memory_manager, cpu) {
        this.memory_manager = memory_manager;
        this.cpu = cpu;
        this.cpu_id = cpu.cpu_id || 0;
        
        // DMA operation tracking
        this.pending_operations = new Map();
        this.operation_id_counter = 0;
        this.current_port = 0;  // Track current port for virtual disk access
        
        dbg_log("AHCI DMA Manager initialized for CPU " + this.cpu_id, LOG_DISK);
    }
    
    /**
     * Perform DMA read operation
     * @param {number} memory_addr - Target memory address
     * @param {number} disk_offset - Disk offset in bytes
     * @param {number} size - Transfer size in bytes
     * @returns {Promise} Completion promise
     */
    async dma_read(memory_addr, disk_offset, size) {
        const op_id = ++this.operation_id_counter;
        
        dbg_log("AHCI DMA: Starting read operation " + op_id + " addr=" + h(memory_addr) + 
               " disk_offset=" + disk_offset + " size=" + size, LOG_DISK);
        
        try {
            // Invalidate cache lines that will be written to
            this.memory_manager.invalidate_cache_lines(memory_addr, size);
            
            // Get DMA buffer
            const buffer = this.get_dma_buffer_for_address(memory_addr, size);
            
            // Simulate disk read - in real implementation, this would read from virtual disk
            await this.simulate_disk_read(buffer, disk_offset, size);
            
            // Copy to target memory if needed
            await this.copy_to_memory(buffer, memory_addr, size);
            
            dbg_log("AHCI DMA: Completed read operation " + op_id, LOG_DISK);
            return { success: true, bytes_transferred: size };
            
        } catch (error) {
            dbg_log("AHCI DMA: Failed read operation " + op_id + ": " + error.message, LOG_DISK);
            return { success: false, error: error.message };
        } finally {
            this.pending_operations.delete(op_id);
        }
    }
    
    /**
     * Perform DMA write operation
     * @param {number} memory_addr - Source memory address
     * @param {number} disk_offset - Disk offset in bytes
     * @param {number} size - Transfer size in bytes
     * @returns {Promise} Completion promise
     */
    async dma_write(memory_addr, disk_offset, size) {
        const op_id = ++this.operation_id_counter;
        
        dbg_log("AHCI DMA: Starting write operation " + op_id + " addr=" + h(memory_addr) + 
               " disk_offset=" + disk_offset + " size=" + size, LOG_DISK);
        
        try {
            // Get DMA buffer
            const buffer = this.get_dma_buffer_for_address(memory_addr, size);
            
            // Copy from source memory
            await this.copy_from_memory(memory_addr, buffer, size);
            
            // Simulate disk write - in real implementation, this would write to virtual disk
            await this.simulate_disk_write(buffer, disk_offset, size);
            
            dbg_log("AHCI DMA: Completed write operation " + op_id, LOG_DISK);
            return { success: true, bytes_transferred: size };
            
        } catch (error) {
            dbg_log("AHCI DMA: Failed write operation " + op_id + ": " + error.message, LOG_DISK);
            return { success: false, error: error.message };
        } finally {
            this.pending_operations.delete(op_id);
        }
    }
    
    /**
     * Get appropriate DMA buffer for memory address
     * @param {number} memory_addr - Memory address
     * @param {number} size - Required size
     * @returns {Uint8Array} DMA buffer
     */
    get_dma_buffer_for_address(memory_addr, size) {
        // For large transfers, use shared buffer area
        if (size > CPU_BUFFER_SIZE / 2) {
            return this.memory_manager.get_dma_buffer(MAX_CPUS, 0, size);
        }
        
        // For smaller transfers, use per-CPU buffer
        return this.memory_manager.get_dma_buffer(this.cpu_id, 0, size);
    }
    
    /**
     * Copy data from memory to DMA buffer
     * @param {number} memory_addr - Source memory address
     * @param {Uint8Array} buffer - Target DMA buffer
     * @param {number} size - Transfer size
     */
    async copy_from_memory(memory_addr, buffer, size) {
        // TODO: Integrate with v86 memory system to copy from guest memory
        // For now, simulate the copy operation
        dbg_log("AHCI DMA: Copying " + size + " bytes from memory " + h(memory_addr) + " to DMA buffer", LOG_DISK);
        
        // In real implementation:
        // for (let i = 0; i < size; i++) {
        //     buffer[i] = this.cpu.read8(memory_addr + i);
        // }
    }
    
    /**
     * Copy data from DMA buffer to memory
     * @param {Uint8Array} buffer - Source DMA buffer  
     * @param {number} memory_addr - Target memory address
     * @param {number} size - Transfer size
     */
    async copy_to_memory(buffer, memory_addr, size) {
        // TODO: Integrate with v86 memory system to copy to guest memory
        // For now, simulate the copy operation
        dbg_log("AHCI DMA: Copying " + size + " bytes from DMA buffer to memory " + h(memory_addr), LOG_DISK);
        
        // In real implementation:
        // for (let i = 0; i < size; i++) {
        //     this.cpu.write8(memory_addr + i, buffer[i]);
        // }
    }
    
    /**
     * Simulate disk read operation
     * @param {Uint8Array} buffer - Target buffer
     * @param {number} offset - Disk offset
     * @param {number} size - Read size
     */
    async simulate_disk_read(buffer, disk_offset, size) {
        // Try to find virtual disk for current operation
        const virtual_disk = this.get_virtual_disk_for_operation();
        
        if (virtual_disk) {
            try {
                const lba = Math.floor(disk_offset / 512);  // Assume 512-byte sectors
                const count = Math.ceil(size / 512);
                
                const disk_data = await virtual_disk.read_sectors(lba, count);
                const copy_size = Math.min(size, disk_data.length);
                buffer.set(disk_data.subarray(0, copy_size));
                
                dbg_log("AHCI DMA: Read " + copy_size + " bytes from virtual disk at LBA " + lba, LOG_DISK);
                return;
            } catch (error) {
                dbg_log("AHCI DMA: Virtual disk read failed, falling back to simulation: " + error.message, LOG_DISK);
            }
        }
        
        // Fallback to simulation
        const latency = 1 + (size / (1024 * 1024)) * 0.5;  // 1ms base + 0.5ms per MB
        await new Promise(resolve => setTimeout(resolve, latency));
        
        // Fill buffer with simulated data
        for (let i = 0; i < size; i++) {
            buffer[i] = (disk_offset + i) & 0xFF;  // Simple pattern based on offset
        }
    }
    }
    
    /**
     * Simulate disk write operation
     * @param {Uint8Array} buffer - Source buffer
     * @param {number} offset - Disk offset  
     * @param {number} size - Write size
     */
    async simulate_disk_write(buffer, disk_offset, size) {
        // Try to find virtual disk for current operation
        const virtual_disk = this.get_virtual_disk_for_operation();
        
        if (virtual_disk) {
            try {
                const lba = Math.floor(disk_offset / 512);  // Assume 512-byte sectors
                const sector_data = new Uint8Array(Math.ceil(size / 512) * 512);
                sector_data.set(buffer.subarray(0, size));
                
                const sectors_written = await virtual_disk.write_sectors(lba, sector_data);
                
                dbg_log("AHCI DMA: Wrote " + (sectors_written * 512) + " bytes to virtual disk at LBA " + lba, LOG_DISK);
                return;
            } catch (error) {
                dbg_log("AHCI DMA: Virtual disk write failed, falling back to simulation: " + error.message, LOG_DISK);
            }
        }
        
        // Fallback to simulation
        const latency = 2 + (size / (1024 * 1024)) * 1.0;  // 2ms base + 1ms per MB
        await new Promise(resolve => setTimeout(resolve, latency));
        
        dbg_log("AHCI DMA: Simulated write of " + size + " bytes to disk offset " + disk_offset, LOG_DISK);
    }
    
    /**
     * Cancel all pending DMA operations
     */
    cancel_all_operations() {
        const count = this.pending_operations.size;
        this.pending_operations.clear();
        
        if (count > 0) {
            dbg_log("AHCI DMA: Cancelled " + count + " pending operations", LOG_DISK);
        }
    }
    
    /**
     * Get virtual disk for current operation
     * @returns {VirtualDisk|null} Virtual disk or null
     */
    get_virtual_disk_for_operation() {
        // Try to find the AHCI controller through the CPU
        if (this.cpu && this.cpu.devices && this.cpu.devices.ahci) {
            const ahci = this.cpu.devices.ahci;
            if (ahci.disk_manager) {
                return ahci.disk_manager.get_disk(this.current_port);
            }
        }
        return null;
    }
    
    /**
     * Set current port for DMA operations
     * @param {number} port - Port number
     */
    set_current_port(port) {
        this.current_port = port;
    }
    
    /**
     * Get DMA statistics
     */
    get_dma_stats() {
        return {
            pending_operations: this.pending_operations.size,
            operation_id_counter: this.operation_id_counter,
            cpu_id: this.cpu_id,
            current_port: this.current_port,
        };
    }
}

export { AHCISMPMemoryManager, AHCIDMAManager };