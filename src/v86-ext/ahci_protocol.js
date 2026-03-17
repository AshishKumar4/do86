/**
 * AHCI SATA Protocol and FIS (Frame Information Structures) Implementation
 * 
 * This module handles the low-level SATA protocol implementation for AHCI,
 * including FIS parsing, command processing, and data transfer management.
 */

import { LOG_DISK } from "./const.js";
import { h } from "./lib.js";
import { dbg_assert, dbg_log } from "./log.js";

// FIS Types
export const FIS_TYPE_REG_H2D = 0x27;    // Register FIS - host to device
export const FIS_TYPE_REG_D2H = 0x34;    // Register FIS - device to host
export const FIS_TYPE_DMA_ACT = 0x39;    // DMA activate FIS - device to host
export const FIS_TYPE_DMA_SETUP = 0x41;  // DMA setup FIS - bidirectional
export const FIS_TYPE_DATA = 0x46;       // Data FIS - bidirectional
export const FIS_TYPE_BIST = 0x58;       // BIST activate FIS - bidirectional
export const FIS_TYPE_PIO_SETUP = 0x5F;  // PIO setup FIS - device to host
export const FIS_TYPE_DEV_BITS = 0xA1;   // Set device bits FIS - device to host

// ATA Command codes
export const ATA_CMD_READ_DMA = 0xC8;          // READ DMA
export const ATA_CMD_READ_DMA_EXT = 0x25;     // READ DMA EXT (48-bit)
export const ATA_CMD_WRITE_DMA = 0xCA;        // WRITE DMA
export const ATA_CMD_WRITE_DMA_EXT = 0x35;    // WRITE DMA EXT (48-bit)
export const ATA_CMD_READ_FPDMA = 0x60;       // READ FPDMA QUEUED (NCQ)
export const ATA_CMD_WRITE_FPDMA = 0x61;      // WRITE FPDMA QUEUED (NCQ)
export const ATA_CMD_IDENTIFY = 0xEC;         // IDENTIFY DEVICE
export const ATA_CMD_FLUSH_CACHE = 0xE7;      // FLUSH CACHE
export const ATA_CMD_FLUSH_CACHE_EXT = 0xEA;  // FLUSH CACHE EXT

// ATA Status register bits
export const ATA_STATUS_ERR = (1 << 0);    // Error
export const ATA_STATUS_DRQ = (1 << 3);    // Data Request
export const ATA_STATUS_DSC = (1 << 4);    // Drive Seek Complete
export const ATA_STATUS_DF = (1 << 5);     // Device Fault
export const ATA_STATUS_DRDY = (1 << 6);   // Drive Ready
export const ATA_STATUS_BSY = (1 << 7);    // Busy

// Command Header flags
export const CMD_HDR_WRITE = (1 << 6);     // Write (host to device)
export const CMD_HDR_ATAPI = (1 << 5);     // ATAPI command
export const CMD_HDR_RESET = (1 << 8);     // Reset
export const CMD_HDR_BIST = (1 << 9);      // BIST
export const CMD_HDR_CLR_BSY = (1 << 10);  // Clear Busy upon R_OK

/**
 * Command Header structure (32 bytes per command slot)
 */
export class AHCICommandHeader {
    constructor(slot, buffer, offset) {
        this.slot = slot;
        this.buffer = buffer;
        this.offset = offset;
    }
    
    // Command and Control flags (bits 0-15)
    get flags() {
        return this.buffer[this.offset] | (this.buffer[this.offset + 1] << 8);
    }
    
    set flags(value) {
        this.buffer[this.offset] = value & 0xFF;
        this.buffer[this.offset + 1] = (value >> 8) & 0xFF;
    }
    
    // Command FIS length in DWORDs (bits 0-4 of first byte)
    get cfl() {
        return this.flags & 0x1F;
    }
    
    // Physical Region Descriptor Table Length (bytes 2-3)
    get prdtl() {
        return this.buffer[this.offset + 2] | (this.buffer[this.offset + 3] << 8);
    }
    
    set prdtl(value) {
        this.buffer[this.offset + 2] = value & 0xFF;
        this.buffer[this.offset + 3] = (value >> 8) & 0xFF;
    }
    
    // Physical Region Descriptor Byte Count (bytes 4-7)
    get prdbc() {
        return this.buffer[this.offset + 4] |
               (this.buffer[this.offset + 5] << 8) |
               (this.buffer[this.offset + 6] << 16) |
               (this.buffer[this.offset + 7] << 24);
    }
    
    set prdbc(value) {
        this.buffer[this.offset + 4] = value & 0xFF;
        this.buffer[this.offset + 5] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 6] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 7] = (value >> 24) & 0xFF;
    }
    
    // Command Table Base Address (bytes 8-15, 64-bit)
    get ctba() {
        const low = this.buffer[this.offset + 8] |
                   (this.buffer[this.offset + 9] << 8) |
                   (this.buffer[this.offset + 10] << 16) |
                   (this.buffer[this.offset + 11] << 24);
        const high = this.buffer[this.offset + 12] |
                    (this.buffer[this.offset + 13] << 8) |
                    (this.buffer[this.offset + 14] << 16) |
                    (this.buffer[this.offset + 15] << 24);
        return { low, high };
    }
    
    set ctba(value) {
        this.buffer[this.offset + 8] = value.low & 0xFF;
        this.buffer[this.offset + 9] = (value.low >> 8) & 0xFF;
        this.buffer[this.offset + 10] = (value.low >> 16) & 0xFF;
        this.buffer[this.offset + 11] = (value.low >> 24) & 0xFF;
        this.buffer[this.offset + 12] = value.high & 0xFF;
        this.buffer[this.offset + 13] = (value.high >> 8) & 0xFF;
        this.buffer[this.offset + 14] = (value.high >> 16) & 0xFF;
        this.buffer[this.offset + 15] = (value.high >> 24) & 0xFF;
    }
}

/**
 * Physical Region Descriptor Table Entry (16 bytes each)
 */
export class PRDTEntry {
    constructor(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }
    
    // Data Base Address (bytes 0-7, 64-bit)
    get dba() {
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
    
    // Data Byte Count (bytes 12-15)
    get dbc() {
        const value = this.buffer[this.offset + 12] |
                     (this.buffer[this.offset + 13] << 8) |
                     (this.buffer[this.offset + 14] << 16) |
                     (this.buffer[this.offset + 15] << 24);
        return (value & 0x3FFFFF) + 1;  // 22-bit value, 0-based
    }
    
    // Interrupt on Completion
    get i() {
        return !!(this.buffer[this.offset + 15] & 0x80);
    }
}

/**
 * Register FIS - Host to Device (27h)
 */
export class RegisterFIS_H2D {
    constructor(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }
    
    get fis_type() { return this.buffer[this.offset + 0]; }
    get flags() { return this.buffer[this.offset + 1]; }
    get command() { return this.buffer[this.offset + 2]; }
    get features() { return this.buffer[this.offset + 3]; }
    
    get lba_low() { return this.buffer[this.offset + 4]; }
    get lba_mid() { return this.buffer[this.offset + 5]; }
    get lba_high() { return this.buffer[this.offset + 6]; }
    get device() { return this.buffer[this.offset + 7]; }
    
    get lba_low_exp() { return this.buffer[this.offset + 8]; }
    get lba_mid_exp() { return this.buffer[this.offset + 9]; }
    get lba_high_exp() { return this.buffer[this.offset + 10]; }
    get features_exp() { return this.buffer[this.offset + 11]; }
    
    get count() { return this.buffer[this.offset + 12] | (this.buffer[this.offset + 13] << 8); }
    get control() { return this.buffer[this.offset + 15]; }
    
    // Get 48-bit LBA
    get lba48() {
        return this.lba_low |
               (this.lba_mid << 8) |
               (this.lba_high << 16) |
               (this.lba_low_exp << 24) |
               (this.lba_mid_exp << 32) |
               (this.lba_high_exp << 40);
    }
    
    // Get 28-bit LBA  
    get lba28() {
        return this.lba_low |
               (this.lba_mid << 8) |
               (this.lba_high << 16) |
               ((this.device & 0xF) << 24);
    }
    
    // Check if this is a command FIS (C bit set)
    get is_command() {
        return !!(this.flags & 0x80);
    }
}

/**
 * Register FIS - Device to Host (34h)
 */
export class RegisterFIS_D2H {
    constructor(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }
    
    set fis_type(value) { this.buffer[this.offset + 0] = value; }
    set flags(value) { this.buffer[this.offset + 1] = value; }
    set status(value) { this.buffer[this.offset + 2] = value; }
    set error(value) { this.buffer[this.offset + 3] = value; }
    
    set lba_low(value) { this.buffer[this.offset + 4] = value; }
    set lba_mid(value) { this.buffer[this.offset + 5] = value; }
    set lba_high(value) { this.buffer[this.offset + 6] = value; }
    set device(value) { this.buffer[this.offset + 7] = value; }
    
    set lba_low_exp(value) { this.buffer[this.offset + 8] = value; }
    set lba_mid_exp(value) { this.buffer[this.offset + 9] = value; }
    set lba_high_exp(value) { this.buffer[this.offset + 10] = value; }
    
    set count(value) { 
        this.buffer[this.offset + 12] = value & 0xFF;
        this.buffer[this.offset + 13] = (value >> 8) & 0xFF;
    }
    
    // Clear the FIS buffer
    clear() {
        for (let i = 0; i < 20; i++) {
            this.buffer[this.offset + i] = 0;
        }
    }
    
    // Create successful command completion FIS
    set_success(lba, count) {
        this.clear();
        this.fis_type = FIS_TYPE_REG_D2H;
        this.flags = 0x40;  // Interrupt bit
        this.status = ATA_STATUS_DRDY | ATA_STATUS_DSC;
        this.error = 0;
        
        // Set LBA if provided
        if (typeof lba === 'number') {
            this.lba_low = lba & 0xFF;
            this.lba_mid = (lba >> 8) & 0xFF;
            this.lba_high = (lba >> 16) & 0xFF;
            this.lba_low_exp = (lba >> 24) & 0xFF;
            this.lba_mid_exp = (lba >> 32) & 0xFF;
            this.lba_high_exp = (lba >> 40) & 0xFF;
        }
        
        if (typeof count === 'number') {
            this.count = count;
        }
    }
    
    // Create error FIS
    set_error(error_code, status = ATA_STATUS_DRDY | ATA_STATUS_ERR) {
        this.clear();
        this.fis_type = FIS_TYPE_REG_D2H;
        this.flags = 0x40;  // Interrupt bit
        this.status = status;
        this.error = error_code;
    }
}

/**
 * DMA Setup FIS (41h)
 */
export class DMASetupFIS {
    constructor(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }
    
    set fis_type(value) { this.buffer[this.offset + 0] = value; }
    set flags(value) { this.buffer[this.offset + 1] = value; }
    
    set dma_buffer_id_low(value) {
        this.buffer[this.offset + 4] = value & 0xFF;
        this.buffer[this.offset + 5] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 6] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 7] = (value >> 24) & 0xFF;
    }
    
    set dma_buffer_id_high(value) {
        this.buffer[this.offset + 8] = value & 0xFF;
        this.buffer[this.offset + 9] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 10] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 11] = (value >> 24) & 0xFF;
    }
    
    set dma_buffer_offset(value) {
        this.buffer[this.offset + 16] = value & 0xFF;
        this.buffer[this.offset + 17] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 18] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 19] = (value >> 24) & 0xFF;
    }
    
    set transfer_count(value) {
        this.buffer[this.offset + 20] = value & 0xFF;
        this.buffer[this.offset + 21] = (value >> 8) & 0xFF;
        this.buffer[this.offset + 22] = (value >> 16) & 0xFF;
        this.buffer[this.offset + 23] = (value >> 24) & 0xFF;
    }
    
    // Clear and setup DMA FIS
    setup_dma(dma_buffer, transfer_size) {
        for (let i = 0; i < 28; i++) {
            this.buffer[this.offset + i] = 0;
        }
        
        this.fis_type = FIS_TYPE_DMA_SETUP;
        this.flags = 0x40;  // Interrupt bit
        this.dma_buffer_id_low = dma_buffer & 0xFFFFFFFF;
        this.dma_buffer_id_high = (dma_buffer >> 32) & 0xFFFFFFFF;
        this.transfer_count = transfer_size;
    }
}

/**
 * AHCI Command Processor - handles command parsing and execution
 */
export class AHCICommandProcessor {
    constructor(controller, port_num) {
        this.controller = controller;
        this.port_num = port_num;
        this.port = controller.ports[port_num];
        
        // Virtual disk interface (to be connected to actual storage)
        this.disk_size = 1024 * 1024 * 1024;  // 1GB default
        this.sector_size = 512;
        this.virtual_disk = null;  // Will be set by disk manager
        
        // SMP integration
        this.smp_memory_manager = controller.smp_memory_manager;
        this.dma_manager = controller.dma_manager;
        
        dbg_log("AHCI Command Processor initialized for port " + port_num, LOG_DISK);
    }
    
    /**
     * Process a command from the command list
     * @param {number} slot - Command slot number
     */
    async process_command(slot) {
        dbg_log("AHCI Port " + this.port_num + ": Processing command slot " + slot, LOG_DISK);
        
        try {
            // Get command header from command list
            const cmd_header = this.get_command_header(slot);
            if (!cmd_header) {
                dbg_log("AHCI Port " + this.port_num + ": Invalid command header for slot " + slot, LOG_DISK);
                this.complete_command_with_error(slot, 0x04);  // Aborted
                return;
            }
            
            // Get command table
            const cmd_table = this.get_command_table(cmd_header);
            if (!cmd_table) {
                dbg_log("AHCI Port " + this.port_num + ": Invalid command table for slot " + slot, LOG_DISK);
                this.complete_command_with_error(slot, 0x04);  // Aborted
                return;
            }
            
            // Parse command FIS
            const cmd_fis = new RegisterFIS_H2D(cmd_table, 0);
            
            if (!cmd_fis.is_command) {
                dbg_log("AHCI Port " + this.port_num + ": Not a command FIS in slot " + slot, LOG_DISK);
                this.complete_command_with_error(slot, 0x04);  // Aborted
                return;
            }
            
            // Execute command based on type
            await this.execute_ata_command(slot, cmd_fis, cmd_header);
            
        } catch (error) {
            dbg_log("AHCI Port " + this.port_num + ": Error processing command slot " + slot + ": " + error.message, LOG_DISK);
            this.complete_command_with_error(slot, 0x04);  // Aborted
        }
    }
    
    /**
     * Get command header from command list
     */
    get_command_header(slot) {
        // Get command list entry from SMP memory manager
        if (this.smp_memory_manager) {
            const cmd_list_entry = this.smp_memory_manager.get_command_list_entry(this.port_num, slot);
            return new AHCICommandHeader(slot, cmd_list_entry, 0);
        }
        
        // Fallback for non-SMP mode
        const clb = this.port.clb | (this.port.clbu << 32);
        if (clb === 0) {
            return null;
        }
        
        // Simulate reading from memory
        const cmd_list_buffer = new Uint8Array(32 * 32);
        return new AHCICommandHeader(slot, cmd_list_buffer, slot * 32);
    }
    
    /**
     * Get command table from command header
     */
    get_command_table(cmd_header) {
        const ctba = cmd_header.ctba;
        if (ctba.low === 0 && ctba.high === 0) {
            return null;
        }
        
        // Get command table from SMP memory manager
        if (this.smp_memory_manager) {
            // Extract table index from command table base address
            const table_index = (ctba.low - 0x03041000) / 2048;  // 2KB per table
            if (table_index >= 0 && table_index < 30) {
                return this.smp_memory_manager.get_command_table(table_index);
            }
        }
        
        // Fallback - simulate command table
        return new Uint8Array(256);
    }
    
    /**
     * Execute ATA command
     */
    async execute_ata_command(slot, cmd_fis, cmd_header) {
        const command = cmd_fis.command;
        
        dbg_log("AHCI Port " + this.port_num + ": Executing ATA command " + h(command) + " in slot " + slot, LOG_DISK);
        
        switch (command) {
            case ATA_CMD_IDENTIFY:
                await this.cmd_identify(slot);
                break;
                
            case ATA_CMD_READ_DMA:
            case ATA_CMD_READ_DMA_EXT:
                await this.cmd_read_dma(slot, cmd_fis, cmd_header);
                break;
                
            case ATA_CMD_WRITE_DMA:
            case ATA_CMD_WRITE_DMA_EXT:
                await this.cmd_write_dma(slot, cmd_fis, cmd_header);
                break;
                
            case ATA_CMD_READ_FPDMA:
                await this.cmd_read_fpdma(slot, cmd_fis, cmd_header);
                break;
                
            case ATA_CMD_WRITE_FPDMA:
                await this.cmd_write_fpdma(slot, cmd_fis, cmd_header);
                break;
                
            case ATA_CMD_FLUSH_CACHE:
            case ATA_CMD_FLUSH_CACHE_EXT:
                await this.cmd_flush_cache(slot);
                break;
                
            default:
                dbg_log("AHCI Port " + this.port_num + ": Unsupported ATA command " + h(command), LOG_DISK);
                this.complete_command_with_error(slot, 0x04);  // Aborted
                break;
        }
    }
    
    /**
     * IDENTIFY DEVICE command
     */
    async cmd_identify(slot) {
        dbg_log("AHCI Port " + this.port_num + ": IDENTIFY DEVICE command", LOG_DISK);
        
        // Create 512-byte identify data
        const identify_data = new Uint16Array(256);
        
        // Fill in basic device information
        identify_data[0] = 0x0040;    // Non-removable media
        identify_data[1] = 16383;     // Logical cylinders
        identify_data[3] = 16;        // Logical heads
        identify_data[6] = 63;        // Logical sectors per track
        identify_data[10] = 0x2020;   // Serial number "v86 AHCI DISK    "
        identify_data[11] = 0x2036;
        identify_data[12] = 0x3620;
        identify_data[13] = 0x4148;
        identify_data[14] = 0x4943;
        identify_data[15] = 0x4920;
        identify_data[16] = 0x4944;
        identify_data[17] = 0x534b;
        identify_data[18] = 0x2020;
        identify_data[19] = 0x2020;
        
        identify_data[27] = 0x7836;   // Model number "v86 AHCI Disk"
        identify_data[28] = 0x3620;
        identify_data[29] = 0x4148;
        identify_data[30] = 0x4943;
        identify_data[31] = 0x4920;
        identify_data[32] = 0x4469;
        identify_data[33] = 0x736b;
        
        identify_data[47] = 0x8001;   // Multiple sectors
        identify_data[49] = 0x0200;   // LBA supported
        identify_data[53] = 0x0006;   // Fields 70-64, 88 valid
        identify_data[60] = (this.disk_size / 512) & 0xFFFF;      // Total LBA sectors (low)
        identify_data[61] = ((this.disk_size / 512) >> 16) & 0xFFFF; // Total LBA sectors (high)
        identify_data[80] = 0x007E;   // Major version (ATA/ATAPI-6)
        identify_data[83] = 0x4000;   // 48-bit LBA supported
        identify_data[86] = 0x4000;   // 48-bit LBA enabled
        identify_data[100] = (this.disk_size / 512) & 0xFFFF;     // 48-bit LBA (0-15)
        identify_data[101] = ((this.disk_size / 512) >> 16) & 0xFFFF; // 48-bit LBA (16-31)
        identify_data[102] = ((this.disk_size / 512) >> 32) & 0xFFFF; // 48-bit LBA (32-47)
        identify_data[103] = ((this.disk_size / 512) >> 48) & 0xFFFF; // 48-bit LBA (48-63)
        
        // TODO: Set up DMA to transfer identify data to host memory
        // For now, just complete the command
        this.complete_command_success(slot);
    }
    
    /**
     * READ DMA command
     */
    async cmd_read_dma(slot, cmd_fis, cmd_header) {
        const lba = cmd_fis.command === ATA_CMD_READ_DMA_EXT ? cmd_fis.lba48 : cmd_fis.lba28;
        const count = cmd_fis.count === 0 ? (cmd_fis.command === ATA_CMD_READ_DMA_EXT ? 65536 : 256) : cmd_fis.count;
        const disk_offset = lba * this.sector_size;
        const transfer_size = count * this.sector_size;
        
        dbg_log("AHCI Port " + this.port_num + ": READ DMA LBA=" + lba + " count=" + count, LOG_DISK);
        
        try {
            // Process Physical Region Descriptor Table entries
            const prdt_entries = this.get_prdt_entries(cmd_header);
            let total_transferred = 0;
            let current_disk_offset = disk_offset;
            
            for (const entry of prdt_entries) {
                const memory_addr = entry.dba.low;  // Assume 32-bit for now
                const size = Math.min(entry.dbc, transfer_size - total_transferred);
                
                if (size === 0) break;
                
                // Perform DMA read using SMP DMA manager
                if (this.dma_manager) {
                    this.dma_manager.set_current_port(this.port_num);
                    const result = await this.dma_manager.dma_read(memory_addr, current_disk_offset, size);
                    if (!result.success) {
                        throw new Error("DMA read failed: " + result.error);
                    }
                } else {
                    // Fallback simulation
                    await this.simulate_disk_operation(size);
                }
                
                total_transferred += size;
                current_disk_offset += size;
                
                if (total_transferred >= transfer_size) break;
            }
            
            this.complete_command_success(slot, lba, count);
            
        } catch (error) {
            dbg_log("AHCI Port " + this.port_num + ": READ DMA failed: " + error.message, LOG_DISK);
            this.complete_command_with_error(slot, 0x04);  // Aborted
        }
    }
    
    /**
     * WRITE DMA command
     */
    async cmd_write_dma(slot, cmd_fis, cmd_header) {
        const lba = cmd_fis.command === ATA_CMD_WRITE_DMA_EXT ? cmd_fis.lba48 : cmd_fis.lba28;
        const count = cmd_fis.count === 0 ? (cmd_fis.command === ATA_CMD_WRITE_DMA_EXT ? 65536 : 256) : cmd_fis.count;
        const disk_offset = lba * this.sector_size;
        const transfer_size = count * this.sector_size;
        
        dbg_log("AHCI Port " + this.port_num + ": WRITE DMA LBA=" + lba + " count=" + count, LOG_DISK);
        
        try {
            // Process Physical Region Descriptor Table entries
            const prdt_entries = this.get_prdt_entries(cmd_header);
            let total_transferred = 0;
            let current_disk_offset = disk_offset;
            
            for (const entry of prdt_entries) {
                const memory_addr = entry.dba.low;  // Assume 32-bit for now
                const size = Math.min(entry.dbc, transfer_size - total_transferred);
                
                if (size === 0) break;
                
                // Perform DMA write using SMP DMA manager
                if (this.dma_manager) {
                    this.dma_manager.set_current_port(this.port_num);
                    const result = await this.dma_manager.dma_write(memory_addr, current_disk_offset, size);
                    if (!result.success) {
                        throw new Error("DMA write failed: " + result.error);
                    }
                } else {
                    // Fallback simulation
                    await this.simulate_disk_operation(size);
                }
                
                total_transferred += size;
                current_disk_offset += size;
                
                if (total_transferred >= transfer_size) break;
            }
            
            this.complete_command_success(slot, lba, count);
            
        } catch (error) {
            dbg_log("AHCI Port " + this.port_num + ": WRITE DMA failed: " + error.message, LOG_DISK);
            this.complete_command_with_error(slot, 0x04);  // Aborted
        }
    }
    
    /**
     * READ FPDMA QUEUED (NCQ) command
     */
    async cmd_read_fpdma(slot, cmd_fis, cmd_header) {
        const lba = cmd_fis.lba48;
        const count = cmd_fis.count;
        
        dbg_log("AHCI Port " + this.port_num + ": READ FPDMA (NCQ) LBA=" + lba + " count=" + count + " slot=" + slot, LOG_DISK);
        
        // Set SATA Active register for NCQ command
        this.port.sact |= (1 << slot);
        
        // TODO: Implement actual NCQ disk read
        await this.simulate_disk_operation(count * 512);
        this.complete_ncq_command(slot, lba, count);
    }
    
    /**
     * WRITE FPDMA QUEUED (NCQ) command
     */
    async cmd_write_fpdma(slot, cmd_fis, cmd_header) {
        const lba = cmd_fis.lba48;
        const count = cmd_fis.count;
        
        dbg_log("AHCI Port " + this.port_num + ": WRITE FPDMA (NCQ) LBA=" + lba + " count=" + count + " slot=" + slot, LOG_DISK);
        
        // Set SATA Active register for NCQ command
        this.port.sact |= (1 << slot);
        
        // TODO: Implement actual NCQ disk write
        await this.simulate_disk_operation(count * 512);
        this.complete_ncq_command(slot, lba, count);
    }
    
    /**
     * FLUSH CACHE command
     */
    async cmd_flush_cache(slot) {
        dbg_log("AHCI Port " + this.port_num + ": FLUSH CACHE command", LOG_DISK);
        
        // TODO: Implement actual cache flush
        await this.simulate_disk_operation(0);
        this.complete_command_success(slot);
    }
    
    /**
     * Simulate disk operation delay
     */
    async simulate_disk_operation(bytes) {
        // If we have a virtual disk, the actual I/O includes its latency
        if (this.virtual_disk) {
            // Virtual disk operations include their own timing
            const latency = 0.5 + (bytes / (1024 * 1024)) * 0.1;  // Reduced since virtual disk adds latency
        } else {
            // Pure simulation latency
            const latency = 2 + (bytes / (1024 * 1024)) * 0.1;
        }
        return new Promise(resolve => setTimeout(resolve, latency));
    }
    
    /**
     * Complete command successfully
     */
    complete_command_success(slot, lba = 0, count = 0) {
        // Clear command from issue register
        this.port.ci &= ~(1 << slot);
        
        // Create D2H Register FIS in FIS receive area
        this.create_d2h_fis(lba, count);
        
        // Set interrupt status
        this.port.is |= (1 << 0);  // D2H Register FIS
        
        // Update port interrupt
        this.port.update_port_interrupt();
        
        dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed successfully", LOG_DISK);
    }
    
    /**
     * Complete NCQ command successfully
     */
    complete_ncq_command(slot, lba, count) {
        // Clear from SATA Active register
        this.port.sact &= ~(1 << slot);
        
        // Clear command from issue register
        this.port.ci &= ~(1 << slot);
        
        // Create Set Device Bits FIS for NCQ completion
        this.create_sdb_fis(slot);
        
        // Set interrupt status
        this.port.is |= (1 << 3);  // Set Device Bits FIS
        
        // Update port interrupt
        this.port.update_port_interrupt();
        
        dbg_log("AHCI Port " + this.port_num + ": NCQ command slot " + slot + " completed", LOG_DISK);
    }
    
    /**
     * Complete command with error
     */
    complete_command_with_error(slot, error_code) {
        // Clear command from issue register
        this.port.ci &= ~(1 << slot);
        
        // Clear from SATA Active if NCQ command
        this.port.sact &= ~(1 << slot);
        
        // Create error D2H Register FIS
        this.create_error_fis(error_code);
        
        // Set interrupt status
        this.port.is |= (1 << 30);  // Task File Error
        
        // Update port interrupt
        this.port.update_port_interrupt();
        
        dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed with error " + h(error_code), LOG_DISK);
    }
    
    /**
     * Create D2H Register FIS in receive area
     */
    create_d2h_fis(lba = 0, count = 0) {
        // TODO: Write to actual FIS receive area in memory
        // For now, just log the operation
        dbg_log("AHCI Port " + this.port_num + ": Created D2H Register FIS", LOG_DISK);
    }
    
    /**
     * Create Set Device Bits FIS for NCQ completion
     */
    create_sdb_fis(slot) {
        // TODO: Write to actual FIS receive area in memory
        // For now, just log the operation
        dbg_log("AHCI Port " + this.port_num + ": Created Set Device Bits FIS for slot " + slot, LOG_DISK);
    }
    
    /**
     * Get Physical Region Descriptor Table entries from command header
     * @param {AHCICommandHeader} cmd_header - Command header
     * @returns {Array<PRDTEntry>} Array of PRDT entries
     */
    get_prdt_entries(cmd_header) {
        const prdtl = cmd_header.prdtl;
        if (prdtl === 0) {
            return [];
        }
        
        // Get command table which contains PRDT entries
        const cmd_table = this.get_command_table(cmd_header);
        if (!cmd_table) {
            return [];
        }
        
        const entries = [];
        const prdt_start = 0x80;  // PRDT starts at offset 0x80 in command table
        
        for (let i = 0; i < prdtl && i < 65535; i++) {  // Max 65535 entries
            const entry_offset = prdt_start + (i * 16);  // 16 bytes per entry
            if (entry_offset + 16 > cmd_table.length) {
                break;
            }
            
            entries.push(new PRDTEntry(cmd_table, entry_offset));
        }
        
        return entries;
    }
    
    /**
     * Create error D2H Register FIS
     */
    create_error_fis(error_code) {
        // TODO: Write to actual FIS receive area in memory
        // For now, just log the operation
        dbg_log("AHCI Port " + this.port_num + ": Created error D2H FIS with error " + h(error_code), LOG_DISK);
    }
    
    /**
     * Get state for save/restore
     */
    get_state() {
        return {
            port_num: this.port_num,
            disk_size: this.disk_size,
            sector_size: this.sector_size,
        };
    }
    
    /**
     * Set state for save/restore
     */
    set_state(state) {
        this.port_num = state.port_num;
        this.disk_size = state.disk_size || (1024 * 1024 * 1024);
        this.sector_size = state.sector_size || 512;
    }
}

export { AHCICommandProcessor };