// Auto-generated AHCI bundle for do86 — stubs for v86 internals
// LOG_DISK stub (v86 log level constant for disk)
const LOG_DISK = 2;
// h(val, len) — hex formatter stub
const h = (v, len) => '0x' + (v>>>0).toString(16).toUpperCase().padStart(len||1,'0');
// dbg_assert/dbg_log — no-ops in production
const dbg_assert = (cond, msg) => { if (!cond) console.error('[AHCI assert]', msg); };
const dbg_log = (msg) => {}; // strip verbose AHCI logs


// ===== ahci_virtual_disk.js =====
/**
 * AHCI Virtual Disk Management
 * 
 * This module provides virtual disk management for AHCI, including integration
 * with Durable Objects for persistent storage in a Cloudflare Workers environment.
 */


// Virtual disk types
const DISK_TYPE_RAM = "ram";           // In-memory disk (non-persistent)
const DISK_TYPE_DURABLE = "durable";   // Durable Object storage  
const DISK_TYPE_FILE = "file";         // File-based (for Node.js)
const DISK_TYPE_BUFFER = "buffer";     // Provided buffer

// Disk geometry constants
const SECTOR_SIZE = 512;
const SECTORS_PER_TRACK = 63;
const HEADS_PER_CYLINDER = 16;
const DEFAULT_DISK_SIZE = 1024 * 1024 * 1024; // 1GB

/**
 * Virtual Disk Interface
 * 
 * Abstract base class for all virtual disk types
 */
class VirtualDisk {
    constructor(size = DEFAULT_DISK_SIZE, sector_size = SECTOR_SIZE) {
        this.size = size;
        this.sector_size = sector_size;
        this.sectors = Math.floor(size / sector_size);
        this.read_only = false;
        this.disk_type = "unknown";
        this.last_access_time = Date.now();
        
        // Calculate CHS geometry
        this.calculate_geometry();
        
        dbg_log("Virtual Disk created: size=" + size + " sectors=" + this.sectors, LOG_DISK);
    }
    
    /**
     * Calculate CHS (Cylinder/Head/Sector) geometry
     */
    calculate_geometry() {
        const total_sectors = this.sectors;
        
        // Use standard disk geometry calculations
        this.heads = HEADS_PER_CYLINDER;
        this.sectors_per_track = SECTORS_PER_TRACK;
        this.cylinders = Math.floor(total_sectors / (this.heads * this.sectors_per_track));
        
        // Ensure we don't exceed common limits
        if (this.cylinders > 65535) {
            this.cylinders = 65535;
        }
        
        dbg_log("Virtual Disk geometry: C=" + this.cylinders + " H=" + this.heads + 
               " S=" + this.sectors_per_track, LOG_DISK);
    }
    
    /**
     * Read sectors from disk
     * @param {number} lba - Logical Block Address
     * @param {number} count - Number of sectors to read
     * @returns {Promise<Uint8Array>} Read data
     */
    async read_sectors(lba, count) {
        throw new Error("read_sectors must be implemented by subclass");
    }
    
    /**
     * Write sectors to disk
     * @param {number} lba - Logical Block Address
     * @param {Uint8Array} data - Data to write
     * @returns {Promise<number>} Number of sectors written
     */
    async write_sectors(lba, data) {
        throw new Error("write_sectors must be implemented by subclass");
    }
    
    /**
     * Flush any cached data to persistent storage
     * @returns {Promise<void>}
     */
    async flush() {
        // Default implementation - no-op
    }
    
    /**
     * Get disk information
     */
    get_info() {
        return {
            size: this.size,
            sectors: this.sectors,
            sector_size: this.sector_size,
            cylinders: this.cylinders,
            heads: this.heads,
            sectors_per_track: this.sectors_per_track,
            read_only: this.read_only,
            disk_type: this.disk_type,
            last_access: this.last_access_time,
        };
    }
    
    /**
     * Validate LBA range
     * @param {number} lba - Starting LBA
     * @param {number} count - Number of sectors
     * @returns {boolean} True if valid
     */
    validate_range(lba, count) {
        if (lba < 0 || count <= 0) {
            return false;
        }
        if (lba + count > this.sectors) {
            return false;
        }
        return true;
    }
    
    /**
     * Update last access time
     */
    update_access_time() {
        this.last_access_time = Date.now();
    }
}

/**
 * RAM-based Virtual Disk
 * 
 * Stores disk data in memory (non-persistent)
 */
class RAMVirtualDisk extends VirtualDisk {
    constructor(size = DEFAULT_DISK_SIZE) {
        super(size);
        this.disk_type = DISK_TYPE_RAM;
        this.data = new Uint8Array(size);
        
        dbg_log("RAM Virtual Disk created: " + Math.round(size / (1024*1024)) + "MB", LOG_DISK);
    }
    
    async read_sectors(lba, count) {
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        const start_byte = lba * this.sector_size;
        const length = count * this.sector_size;
        
        const result = new Uint8Array(length);
        result.set(this.data.subarray(start_byte, start_byte + length));
        
        dbg_log("RAM Disk read: LBA=" + lba + " count=" + count + " bytes=" + length, LOG_DISK);
        return result;
    }
    
    async write_sectors(lba, data) {
        if (this.read_only) {
            throw new Error("Disk is read-only");
        }
        
        const count = Math.floor(data.length / this.sector_size);
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        const start_byte = lba * this.sector_size;
        const length = count * this.sector_size;
        
        this.data.set(data.subarray(0, length), start_byte);
        
        dbg_log("RAM Disk write: LBA=" + lba + " count=" + count + " bytes=" + length, LOG_DISK);
        return count;
    }
    
    /**
     * Fill disk with pattern (useful for testing)
     * @param {number} pattern - Byte pattern to fill with
     */
    fill_pattern(pattern = 0) {
        this.data.fill(pattern);
        dbg_log("RAM Disk filled with pattern " + h(pattern), LOG_DISK);
    }
    
    /**
     * Load disk image from buffer
     * @param {Uint8Array} buffer - Disk image data
     */
    load_from_buffer(buffer) {
        const copy_size = Math.min(buffer.length, this.data.length);
        this.data.set(buffer.subarray(0, copy_size));
        
        dbg_log("RAM Disk loaded " + copy_size + " bytes from buffer", LOG_DISK);
    }
}

/**
 * Buffer-based Virtual Disk
 * 
 * Uses an existing buffer as disk storage
 */
class BufferVirtualDisk extends VirtualDisk {
    constructor(buffer) {
        super(buffer.length);
        this.disk_type = DISK_TYPE_BUFFER;
        this.data = buffer;
        
        dbg_log("Buffer Virtual Disk created: " + Math.round(buffer.length / (1024*1024)) + "MB", LOG_DISK);
    }
    
    async read_sectors(lba, count) {
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        const start_byte = lba * this.sector_size;
        const length = count * this.sector_size;
        
        const result = new Uint8Array(length);
        result.set(this.data.subarray(start_byte, start_byte + length));
        
        return result;
    }
    
    async write_sectors(lba, data) {
        if (this.read_only) {
            throw new Error("Disk is read-only");
        }
        
        const count = Math.floor(data.length / this.sector_size);
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        const start_byte = lba * this.sector_size;
        const length = count * this.sector_size;
        
        this.data.set(data.subarray(0, length), start_byte);
        
        return count;
    }
}

/**
 * Durable Object Virtual Disk
 * 
 * Stores disk data in Cloudflare Durable Objects for persistence
 */
class DurableObjectVirtualDisk extends VirtualDisk {
    constructor(durable_object_id, size = DEFAULT_DISK_SIZE) {
        super(size);
        this.disk_type = DISK_TYPE_DURABLE;
        this.durable_object_id = durable_object_id;
        this.cache = new Map(); // LRU cache for frequently accessed blocks
        this.cache_size = 1024; // Cache up to 1024 sectors (512KB)
        this.dirty_blocks = new Set(); // Track modified blocks
        this.pending_writes = new Map(); // Track pending write operations
        
        dbg_log("Durable Object Virtual Disk created: ID=" + durable_object_id + 
               " size=" + Math.round(size / (1024*1024)) + "MB", LOG_DISK);
    }
    
    async read_sectors(lba, count) {
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        const result = new Uint8Array(count * this.sector_size);
        let result_offset = 0;
        
        // Read sector by sector, using cache when possible
        for (let i = 0; i < count; i++) {
            const sector_lba = lba + i;
            const sector_data = await this.read_single_sector(sector_lba);
            result.set(sector_data, result_offset);
            result_offset += this.sector_size;
        }
        
        dbg_log("Durable Object read: LBA=" + lba + " count=" + count, LOG_DISK);
        return result;
    }
    
    async write_sectors(lba, data) {
        if (this.read_only) {
            throw new Error("Disk is read-only");
        }
        
        const count = Math.floor(data.length / this.sector_size);
        if (!this.validate_range(lba, count)) {
            throw new Error("Invalid LBA range: " + lba + "+" + count);
        }
        
        this.update_access_time();
        
        // Write sector by sector to cache and mark dirty
        for (let i = 0; i < count; i++) {
            const sector_lba = lba + i;
            const sector_offset = i * this.sector_size;
            const sector_data = data.subarray(sector_offset, sector_offset + this.sector_size);
            
            await this.write_single_sector(sector_lba, sector_data);
        }
        
        dbg_log("Durable Object write: LBA=" + lba + " count=" + count, LOG_DISK);
        return count;
    }
    
    /**
     * Read a single sector, using cache if available
     * @param {number} lba - Sector LBA
     * @returns {Promise<Uint8Array>} Sector data
     */
    async read_single_sector(lba) {
        // Check cache first
        if (this.cache.has(lba)) {
            const cached_data = this.cache.get(lba);
            // Move to end (LRU)
            this.cache.delete(lba);
            this.cache.set(lba, cached_data);
            return new Uint8Array(cached_data);
        }
        
        // Not in cache, read from Durable Object
        const sector_data = await this.read_from_durable_object(lba);
        
        // Add to cache
        this.add_to_cache(lba, sector_data);
        
        return sector_data;
    }
    
    /**
     * Write a single sector to cache and mark dirty
     * @param {number} lba - Sector LBA
     * @param {Uint8Array} data - Sector data
     */
    async write_single_sector(lba, data) {
        // Update cache
        this.cache.set(lba, new Uint8Array(data));
        
        // Mark as dirty for later flush
        this.dirty_blocks.add(lba);
        
        // Evict oldest entries if cache is full
        this.evict_cache_if_needed();
        
        // For write-through behavior, could also write to DO immediately:
        // await this.write_to_durable_object(lba, data);
    }
    
    /**
     * Add sector to cache with LRU eviction
     * @param {number} lba - Sector LBA
     * @param {Uint8Array} data - Sector data
     */
    add_to_cache(lba, data) {
        // Add new entry
        this.cache.set(lba, new Uint8Array(data));
        
        // Evict if necessary
        this.evict_cache_if_needed();
    }
    
    /**
     * Evict cache entries if over limit
     */
    evict_cache_if_needed() {
        while (this.cache.size > this.cache_size) {
            // Remove oldest entry (first in map)
            const oldest_lba = this.cache.keys().next().value;
            
            // If it's dirty, we should flush it first
            if (this.dirty_blocks.has(oldest_lba)) {
                // Schedule async write but don't wait
                this.write_to_durable_object(oldest_lba, this.cache.get(oldest_lba))
                    .catch(error => {
                        dbg_log("Durable Object background write failed: " + error.message, LOG_DISK);
                    });
                this.dirty_blocks.delete(oldest_lba);
            }
            
            this.cache.delete(oldest_lba);
        }
    }
    
    /**
     * Read sector from Durable Object
     * @param {number} lba - Sector LBA
     * @returns {Promise<Uint8Array>} Sector data
     */
    async read_from_durable_object(lba) {
        // Simulate Durable Object read
        // In a real implementation, this would make a request to a Durable Object
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate some data pattern
                const data = new Uint8Array(this.sector_size);
                for (let i = 0; i < this.sector_size; i++) {
                    data[i] = ((lba * this.sector_size + i) & 0xFF);
                }
                resolve(data);
            }, 1); // 1ms simulated latency
        });
    }
    
    /**
     * Write sector to Durable Object
     * @param {number} lba - Sector LBA
     * @param {Uint8Array} data - Sector data
     * @returns {Promise<void>}
     */
    async write_to_durable_object(lba, data) {
        // Simulate Durable Object write
        // In a real implementation, this would make a request to a Durable Object
        return new Promise((resolve) => {
            setTimeout(() => {
                dbg_log("Durable Object: Wrote sector " + lba, LOG_DISK);
                resolve();
            }, 2); // 2ms simulated latency
        });
    }
    
    /**
     * Flush all dirty blocks to persistent storage
     */
    async flush() {
        const dirty_lbas = Array.from(this.dirty_blocks);
        
        if (dirty_lbas.length === 0) {
            return; // Nothing to flush
        }
        
        dbg_log("Durable Object flush: " + dirty_lbas.length + " dirty blocks", LOG_DISK);
        
        // Write all dirty blocks in parallel
        const write_promises = dirty_lbas.map(lba => {
            const sector_data = this.cache.get(lba);
            if (sector_data) {
                return this.write_to_durable_object(lba, sector_data);
            }
            return Promise.resolve();
        });
        
        await Promise.all(write_promises);
        
        // Clear dirty set
        this.dirty_blocks.clear();
        
        dbg_log("Durable Object flush completed", LOG_DISK);
    }
    
    /**
     * Get cache statistics
     */
    get_cache_stats() {
        return {
            cache_entries: this.cache.size,
            cache_limit: this.cache_size,
            dirty_blocks: this.dirty_blocks.size,
            hit_ratio: this.cache_hits / (this.cache_hits + this.cache_misses) || 0,
        };
    }
}

/**
 * Virtual Disk Manager
 * 
 * Manages multiple virtual disks for AHCI ports
 */
class VirtualDiskManager {
    constructor() {
        this.disks = new Map(); // port -> VirtualDisk
        this.default_disk_size = DEFAULT_DISK_SIZE;
        
        dbg_log("Virtual Disk Manager initialized", LOG_DISK);
    }
    
    /**
     * Create a virtual disk for a port
     * @param {number} port - Port number
     * @param {string} type - Disk type (ram, durable, buffer, file)
     * @param {Object} options - Disk options
     * @returns {VirtualDisk} Created disk
     */
    create_disk(port, type = DISK_TYPE_RAM, options = {}) {
        let disk;
        
        const size = options.size || this.default_disk_size;
        
        switch (type) {
            case DISK_TYPE_RAM:
                disk = new RAMVirtualDisk(size);
                break;
                
            case DISK_TYPE_DURABLE:
                const do_id = options.durable_object_id || ("disk_port_" + port);
                disk = new DurableObjectVirtualDisk(do_id, size);
                break;
                
            case DISK_TYPE_BUFFER:
                if (!options.buffer) {
                    throw new Error("Buffer must be provided for buffer disk");
                }
                disk = new BufferVirtualDisk(options.buffer);
                break;
                
            default:
                throw new Error("Unsupported disk type: " + type);
        }
        
        if (options.read_only) {
            disk.read_only = true;
        }
        
        this.disks.set(port, disk);
        
        dbg_log("Virtual Disk Manager: Created " + type + " disk for port " + port, LOG_DISK);
        return disk;
    }
    
    /**
     * Get virtual disk for a port
     * @param {number} port - Port number
     * @returns {VirtualDisk|null} Virtual disk or null if not found
     */
    get_disk(port) {
        return this.disks.get(port) || null;
    }
    
    /**
     * Remove virtual disk for a port
     * @param {number} port - Port number
     */
    remove_disk(port) {
        const disk = this.disks.get(port);
        if (disk) {
            // Flush any pending data
            disk.flush().catch(error => {
                dbg_log("Error flushing disk during removal: " + error.message, LOG_DISK);
            });
        }
        
        this.disks.delete(port);
        dbg_log("Virtual Disk Manager: Removed disk for port " + port, LOG_DISK);
    }
    
    /**
     * Flush all disks
     */
    async flush_all() {
        const flush_promises = [];
        
        for (const [port, disk] of this.disks) {
            flush_promises.push(
                disk.flush().catch(error => {
                    dbg_log("Error flushing disk port " + port + ": " + error.message, LOG_DISK);
                })
            );
        }
        
        await Promise.all(flush_promises);
        dbg_log("Virtual Disk Manager: Flushed all disks", LOG_DISK);
    }
    
    /**
     * Get statistics for all disks
     */
    get_stats() {
        const stats = {
            total_disks: this.disks.size,
            disk_info: {},
        };
        
        for (const [port, disk] of this.disks) {
            stats.disk_info[port] = disk.get_info();
        }
        
        return stats;
    }
    
    /**
     * Load disk from settings
     * @param {number} port - Port number
     * @param {Object} settings - Disk settings
     */
    load_disk_from_settings(port, settings) {
        if (!settings) {
            // Create default RAM disk
            return this.create_disk(port, DISK_TYPE_RAM);
        }
        
        const type = settings.type || DISK_TYPE_RAM;
        const options = {
            size: settings.size,
            read_only: settings.read_only,
            buffer: settings.buffer,
            durable_object_id: settings.durable_object_id,
        };
        
        return this.create_disk(port, type, options);
    }
}

// (VirtualDisk etc. available via AHCIController.disk_manager)

// ===== ahci_msi.js =====
/**
 * AHCI MSI (Message Signaled Interrupts) Support
 * 
 * This module implements MSI and MSI-X interrupt support for AHCI,
 * integrating with the enhanced APIC system from Phase 2.
 */


// MSI Capability Structure offsets (in PCI config space)
const MSI_CAP_ID = 0x05;
const MSIX_CAP_ID = 0x11;

// MSI Control register bits
const MSI_ENABLE = (1 << 0);
const MSI_MULTIPLE_MSG_CAP_MASK = 0x0E;
const MSI_MULTIPLE_MSG_CAP_SHIFT = 1;
const MSI_MULTIPLE_MSG_EN_MASK = 0x70;
const MSI_MULTIPLE_MSG_EN_SHIFT = 4;
const MSI_64BIT_ADDR_CAP = (1 << 7);
const MSI_PER_VECTOR_MASK_CAP = (1 << 8);

// MSI-X Control register bits
const MSIX_ENABLE = (1 << 15);
const MSIX_FUNCTION_MASK = (1 << 14);
const MSIX_TABLE_SIZE_MASK = 0x7FF;

// AHCI Interrupt vectors
const AHCI_IRQ_PORT_BASE = 0x30;      // Base vector for port interrupts
const AHCI_IRQ_GLOBAL = 0x38;        // Global AHCI interrupt
const AHCI_IRQ_ERROR = 0x39;         // AHCI error interrupt
const AHCI_IRQ_HOT_PLUG = 0x3A;      // Hot plug interrupt

/**
 * MSI Table Entry (16 bytes each for MSI-X)
 */
class MSIXTableEntry {
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
class AHCIMSIManager {
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


// ===== ahci_smp_integration.js =====
/**
 * AHCI SMP Integration Module
 * 
 * This module handles the integration of AHCI with the SMP (Symmetric Multi-Processing)
 * architecture from Phase 3, including shared memory access, cache coherency, and 
 * multi-CPU command processing.
 */


// SMP Memory Layout Constants (from ahci_memory_layout_design.md)
const AHCI_COMMAND_LISTS_BASE = 0x03040000;    // 4KB - Command lists
const AHCI_COMMAND_TABLES_BASE = 0x03041000;   // 60KB - Command tables  
const AHCI_DATA_BUFFERS_BASE = 0x03050000;     // 3.75MB - DMA buffers
const AHCI_FIS_BUFFERS_BASE = 0x03400000;      // 4KB - FIS buffers

// Per-CPU buffer allocation (for 8 CPUs)
const CPU_BUFFER_SIZE = 480 * 1024;  // 480KB per CPU
const SHARED_BUFFER_SIZE = 960 * 1024;  // 960KB shared

// Command slot allocation per CPU (32 slots total, 4 per CPU for 8 CPUs)
const SLOTS_PER_CPU = 4;
const MAX_CPUS = 8;

/**
 * AHCI SMP Memory Manager
 * 
 * Handles shared memory allocation and access coordination between multiple CPUs
 */
class AHCISMPMemoryManager {
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
class AHCIDMAManager {
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


// ===== ahci_protocol.js =====
/**
 * AHCI SATA Protocol and FIS (Frame Information Structures) Implementation
 * 
 * This module handles the low-level SATA protocol implementation for AHCI,
 * including FIS parsing, command processing, and data transfer management.
 */


// FIS Types
const FIS_TYPE_REG_H2D = 0x27;    // Register FIS - host to device
const FIS_TYPE_REG_D2H = 0x34;    // Register FIS - device to host
const FIS_TYPE_DMA_ACT = 0x39;    // DMA activate FIS - device to host
const FIS_TYPE_DMA_SETUP = 0x41;  // DMA setup FIS - bidirectional
const FIS_TYPE_DATA = 0x46;       // Data FIS - bidirectional
const FIS_TYPE_BIST = 0x58;       // BIST activate FIS - bidirectional
const FIS_TYPE_PIO_SETUP = 0x5F;  // PIO setup FIS - device to host
const FIS_TYPE_DEV_BITS = 0xA1;   // Set device bits FIS - device to host

// ATA Command codes
const ATA_CMD_READ_DMA = 0xC8;          // READ DMA
const ATA_CMD_READ_DMA_EXT = 0x25;     // READ DMA EXT (48-bit)
const ATA_CMD_WRITE_DMA = 0xCA;        // WRITE DMA
const ATA_CMD_WRITE_DMA_EXT = 0x35;    // WRITE DMA EXT (48-bit)
const ATA_CMD_READ_FPDMA = 0x60;       // READ FPDMA QUEUED (NCQ)
const ATA_CMD_WRITE_FPDMA = 0x61;      // WRITE FPDMA QUEUED (NCQ)
const ATA_CMD_IDENTIFY = 0xEC;         // IDENTIFY DEVICE
const ATA_CMD_FLUSH_CACHE = 0xE7;      // FLUSH CACHE
const ATA_CMD_FLUSH_CACHE_EXT = 0xEA;  // FLUSH CACHE EXT

// ATA Status register bits
const ATA_STATUS_ERR = (1 << 0);    // Error
const ATA_STATUS_DRQ = (1 << 3);    // Data Request
const ATA_STATUS_DSC = (1 << 4);    // Drive Seek Complete
const ATA_STATUS_DF = (1 << 5);     // Device Fault
const ATA_STATUS_DRDY = (1 << 6);   // Drive Ready
const ATA_STATUS_BSY = (1 << 7);    // Busy

// Command Header flags
const CMD_HDR_WRITE = (1 << 6);     // Write (host to device)
const CMD_HDR_ATAPI = (1 << 5);     // ATAPI command
const CMD_HDR_RESET = (1 << 8);     // Reset
const CMD_HDR_BIST = (1 << 9);      // BIST
const CMD_HDR_CLR_BSY = (1 << 10);  // Clear Busy upon R_OK

/**
 * Command Header structure (32 bytes per command slot)
 */
class AHCICommandHeader {
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
class PRDTEntry {
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
class RegisterFIS_H2D {
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
class RegisterFIS_D2H {
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
class DMASetupFIS {
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
class AHCICommandProcessor {
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


// ===== ahci.js =====
/**
 * AHCI (Advanced Host Controller Interface) Disk Controller Emulation for v86
 * 
 * This implements a complete AHCI controller with SMP support, building on the 
 * enhanced APIC system from Phase 2 and SMP architecture from Phase 3.
 * 
 * References:
 * - AHCI Specification Revision 1.3.1 (June 27, 2008)
 * - Serial ATA AHCI Specification, Rev. 1.3
 * - Intel® I/O Controller Hub 9 (ICH9) Family Datasheet
 */


// For Types Only

// AHCI Memory Layout (as designed in ahci_memory_layout_design.md)
const AHCI_MEM_ADDRESS = 0xFEBF0000;    // BAR5 - HBA registers
const AHCI_MEM_SIZE = 0x1000;           // 4KB

// AHCI memory regions in system RAM
const AHCI_COMMAND_LISTS_BASE = 0x03040000;    // 4KB - Command lists
const AHCI_COMMAND_TABLES_BASE = 0x03041000;   // 60KB - Command tables  
const AHCI_DATA_BUFFERS_BASE = 0x03050000;     // 3.75MB - DMA buffers
const AHCI_FIS_BUFFERS_BASE = 0x03400000;      // 4KB - FIS buffers

// AHCI Constants
const AHCI_MAX_PORTS = 32;
const AHCI_MAX_CMDS = 32;
const AHCI_CMD_SLOT_SIZE = 32;      // bytes per command slot
const AHCI_CMD_TBL_SIZE = 256;      // bytes per command table (minimum)
const AHCI_FIS_SIZE = 256;          // bytes per FIS buffer

// HBA Global Register Offsets
const HBA_CAP     = 0x00;   // Host Capabilities
const HBA_GHC     = 0x04;   // Global Host Control  
const HBA_IS      = 0x08;   // Interrupt Status
const HBA_PI      = 0x0C;   // Ports Implemented
const HBA_VS      = 0x10;   // Version
const HBA_CCC_CTL = 0x14;   // Command Completion Coalescing Control
const HBA_CCC_PORTS = 0x18; // Command Completion Coalescing Ports
const HBA_EM_LOC  = 0x1C;   // Enclosure Management Location
const HBA_EM_CTL  = 0x20;   // Enclosure Management Control
const HBA_CAP2    = 0x24;   // Host Capabilities Extended
const HBA_BOHC    = 0x28;   // BIOS/OS Handoff Control and Status

// Port Register Offsets (relative to port base)
const PORT_CLB     = 0x00;  // Command List Base Address
const PORT_CLBU    = 0x04;  // Command List Base Address Upper 32-bits
const PORT_FB      = 0x08;  // FIS Base Address
const PORT_FBU     = 0x0C;  // FIS Base Address Upper 32-bits
const PORT_IS      = 0x10;  // Interrupt Status
const PORT_IE      = 0x14;  // Interrupt Enable
const PORT_CMD     = 0x18;  // Command and Status
const PORT_TFD     = 0x20;  // Task File Data
const PORT_SIG     = 0x24;  // Signature
const PORT_SSTS    = 0x28;  // SATA Status (SCR0: SStatus)
const PORT_SCTL    = 0x2C;  // SATA Control (SCR2: SControl)
const PORT_SERR    = 0x30;  // SATA Error (SCR1: SError)
const PORT_SACT    = 0x34;  // SATA Active (SCR3: SActive)
const PORT_CI      = 0x38;  // Command Issue
const PORT_SNTF    = 0x3C;  // SATA Notification (SCR4: SNotification)

// Host Capabilities (CAP) register bits
const CAP_NP_MASK     = 0x1F;      // Number of Ports
const CAP_SXS         = (1 << 5);  // Supports External SATA
const CAP_EMS         = (1 << 6);  // Enclosure Management Supported
const CAP_CCCS        = (1 << 7);  // Command Completion Coalescing Supported
const CAP_NCS_MASK    = 0x1F00;    // Number of Command Slots
const CAP_NCS_SHIFT   = 8;
const CAP_PSC         = (1 << 13); // Partial State Capable
const CAP_SSC         = (1 << 14); // Slumber State Capable
const CAP_PMD         = (1 << 15); // PIO Multiple DRQ Block
const CAP_FBSS        = (1 << 16); // FIS-based Switching Supported
const CAP_SPM         = (1 << 17); // Supports Port Multiplier
const CAP_SAM         = (1 << 18); // Supports AHCI mode only
const CAP_SNZO        = (1 << 19); // Supports Non-Zero DMA Offsets
const CAP_ISS_MASK    = 0xF00000;  // Interface Speed Support
const CAP_ISS_SHIFT   = 20;
const CAP_SCLO        = (1 << 24); // Supports Command List Override
const CAP_SAL         = (1 << 25); // Supports Activity LED
const CAP_SALP        = (1 << 26); // Supports Aggressive Link Power Management
const CAP_SSS         = (1 << 27); // Supports Staggered Spin-up
const CAP_SMPS        = (1 << 28); // Supports Mechanical Presence Switch
const CAP_SSNTF       = (1 << 29); // Supports SNotification Register
const CAP_SNCQ        = (1 << 30); // Supports Native Command Queuing
const CAP_S64A        = (1 << 31); // Supports 64-bit Addressing

// Global Host Control (GHC) register bits
const GHC_HR          = (1 << 0);  // HBA Reset
const GHC_IE          = (1 << 1);  // Interrupt Enable
const GHC_MRSM        = (1 << 2);  // MSI Revert to Single Message
const GHC_AE          = (1 << 31); // AHCI Enable

// Port Command (CMD) register bits
const CMD_ST          = (1 << 0);  // Start
const CMD_SUD         = (1 << 1);  // Spin-Up Device
const CMD_POD         = (1 << 2);  // Power On Device
const CMD_CLO         = (1 << 3);  // Command List Override
const CMD_FRE         = (1 << 4);  // FIS Receive Enable
const CMD_CCS_MASK    = 0x1F00;    // Current Command Slot
const CMD_CCS_SHIFT   = 8;
const CMD_MPSS        = (1 << 13); // Mechanical Presence Switch State
const CMD_FR          = (1 << 14); // FIS Receive Running
const CMD_CR          = (1 << 15); // Command List Running
const CMD_CPS         = (1 << 16); // Cold Presence State
const CMD_PMA         = (1 << 17); // Port Multiplier Attached
const CMD_HPCP        = (1 << 18); // Hot Plug Capable Port
const CMD_MPSP        = (1 << 19); // Mechanical Presence Switch Present
const CMD_CPD         = (1 << 20); // Cold Presence Detection
const CMD_ESP         = (1 << 21); // External SATA Port
const CMD_FBSCP       = (1 << 22); // FIS-based Switching Capable Port
const CMD_APSTE       = (1 << 23); // Automatic Partial to Slumber Transition Enable
const CMD_ATAPI       = (1 << 24); // Device is ATAPI
const CMD_DLAE        = (1 << 25); // Drive LED on ATAPI Enable
const CMD_ALPE        = (1 << 26); // Aggressive Link Power Management Enable
const CMD_ASP         = (1 << 27); // Aggressive Slumber / Partial
const CMD_ICC_MASK    = 0xF0000000; // Interface Communication Control
const CMD_ICC_SHIFT   = 28;

// Port Task File Data (TFD) register bits
const TFD_STS_MASK    = 0xFF;      // Status
const TFD_ERR_MASK    = 0xFF00;    // Error
const TFD_ERR_SHIFT   = 8;

// Port Interrupt Status/Enable register bits
const PORT_IRQ_DHRS   = (1 << 0);  // Device to Host Register FIS
const PORT_IRQ_PSS    = (1 << 1);  // PIO Setup FIS
const PORT_IRQ_DSS    = (1 << 2);  // DMA Setup FIS  
const PORT_IRQ_SDBS   = (1 << 3);  // Set Device Bits FIS
const PORT_IRQ_UFS    = (1 << 4);  // Unknown FIS
const PORT_IRQ_DPS    = (1 << 5);  // Descriptor Processed
const PORT_IRQ_PCS    = (1 << 6);  // Port Connect Change Status
const PORT_IRQ_DMPS   = (1 << 7);  // Device Mechanical Presence Status
const PORT_IRQ_PRCS   = (1 << 22); // PhyRdy Change Status  
const PORT_IRQ_IPMS   = (1 << 23); // Incorrect Port Multiplier Status
const PORT_IRQ_OFS    = (1 << 24); // Overflow Status
const PORT_IRQ_INFS   = (1 << 26); // Interface Non-Fatal Error Status
const PORT_IRQ_IFS    = (1 << 27); // Interface Fatal Error Status
const PORT_IRQ_HBDS   = (1 << 28); // Host Bus Data Error Status
const PORT_IRQ_HBFS   = (1 << 29); // Host Bus Fatal Error Status
const PORT_IRQ_TFES   = (1 << 30); // Task File Error Status
const PORT_IRQ_CPDS   = (1 << 31); // Cold Port Detect Status

// SATA Status (SSTS) register bits
const SSTS_DET_MASK   = 0xF;       // Device Detection
const SSTS_SPD_MASK   = 0xF0;      // Current Interface Speed
const SSTS_IPM_MASK   = 0xF00;     // Interface Power Management

// SATA Signature values
const SIG_ATA         = 0x00000101; // SATA drive
const SIG_ATAPI       = 0xEB140101; // SATAPI drive
const SIG_SEMB        = 0xC33C0101; // Enclosure management bridge
const SIG_PM          = 0x96690101; // Port multiplier

// FIS Types
const FIS_TYPE_REG_H2D    = 0x27;  // Register FIS - host to device
const FIS_TYPE_REG_D2H    = 0x34;  // Register FIS - device to host
const FIS_TYPE_DMA_ACT    = 0x39;  // DMA activate FIS - device to host
const FIS_TYPE_DMA_SETUP  = 0x41;  // DMA setup FIS - bidirectional
const FIS_TYPE_DATA       = 0x46;  // Data FIS - bidirectional
const FIS_TYPE_BIST       = 0x58;  // BIST activate FIS - bidirectional
const FIS_TYPE_PIO_SETUP  = 0x5F;  // PIO setup FIS - device to host
const FIS_TYPE_DEV_BITS   = 0xA1;  // Set device bits FIS - device to host

/**
 * AHCI Controller - Main class implementing the AHCI Host Bus Adapter
 * 
 * @constructor
 * @param {CPU} cpu
 * @param {BusConnector} bus
 */
function AHCIController(cpu, bus) {
    /** @const @type {CPU} */
    this.cpu = cpu;
    
    /** @const @type {BusConnector} */
    this.bus = bus;
    
    // HBA Global Registers
    this.cap = 0;           // Host Capabilities
    this.ghc = 0;           // Global Host Control
    this.is = 0;            // Interrupt Status
    this.pi = 0;            // Ports Implemented
    this.vs = 0;            // Version
    this.ccc_ctl = 0;       // Command Completion Coalescing Control
    this.ccc_ports = 0;     // Command Completion Coalescing Ports
    this.em_loc = 0;        // Enclosure Management Location
    this.em_ctl = 0;        // Enclosure Management Control
    this.cap2 = 0;          // Host Capabilities Extended
    this.bohc = 0;          // BIOS/OS Handoff Control
    
    // Ports (up to 32, but typically 4-8)
    this.num_ports = 4;     // Start with 4 ports
    this.ports = [];
    
    for (let i = 0; i < this.num_ports; i++) {
        this.ports[i] = new AHCIPort(this, i);
    }
    
    // Initialize HBA capabilities
    this.init_hba_capabilities();
    
    // Register as PCI device
    this.init_pci_device();
    
    // Register memory-mapped I/O
    this.init_mmio();
    
    // Initialize SMP support
    this.init_smp_support();
    
    // Initialize SMP memory manager
    this.smp_memory_manager = new AHCISMPMemoryManager(this.cpu, this.cpu.shared_memory);
    
    // Initialize DMA manager
    this.dma_manager = new AHCIDMAManager(this.smp_memory_manager, this.cpu);
    
    // Initialize MSI manager
    this.msi_manager = new AHCIMSIManager(this);
    
    // Initialize virtual disk manager
    this.disk_manager = new VirtualDiskManager();
    
    // Create default disks for each port
    this.init_default_disks();
    
    dbg_log("AHCI Controller initialized with " + this.num_ports + " ports", LOG_DISK);
}

/**
 * Initialize HBA capabilities and version information
 */
AHCIController.prototype.init_hba_capabilities = function() {
    // Host Capabilities (CAP)
    this.cap = (
        ((this.num_ports - 1) & CAP_NP_MASK) |           // Number of ports
        ((AHCI_MAX_CMDS - 1) << CAP_NCS_SHIFT) |         // Number of command slots  
        CAP_SNCQ |                                       // Native Command Queuing
        CAP_SSNTF |                                      // SNotification Register
        CAP_SALP |                                       // Aggressive Link PM
        CAP_SAL |                                        // Activity LED
        (0x3 << CAP_ISS_SHIFT) |                        // 6 Gbps interface speed
        CAP_PMD |                                        // PIO Multiple DRQ
        CAP_SSC |                                        // Slumber State Capable
        CAP_PSC                                          // Partial State Capable
    );
    
    // Host Capabilities Extended (CAP2)
    this.cap2 = 0; // Basic implementation for now
    
    // Version (VS) - AHCI 1.3.1
    this.vs = 0x00010301;
    
    // Ports Implemented (PI) - Enable first num_ports
    this.pi = (1 << this.num_ports) - 1;
    
    // Global Host Control (GHC) - AHCI enabled by default
    this.ghc = GHC_AE;
};

/**
 * Initialize PCI device configuration
 */
AHCIController.prototype.init_pci_device = function() {
    // PCI Configuration Space for AHCI Controller
    this.name = "ahci";
    this.pci_id = 0x1F << 3;  // Device 1F, Function 0
    
    this.pci_space = [
        // Standard PCI Header
        0x86, 0x80,             // Vendor ID: Intel
        0x02, 0x26,             // Device ID: AHCI Controller (ICH8M)
        0x07, 0x04,             // Command: Memory access + Bus master
        0x90, 0x02,             // Status: Fast back-to-back, 66MHz capable
        0x03,                   // Revision ID
        0x01,                   // Programming Interface: AHCI
        0x06,                   // Sub-class: Serial ATA controller  
        0x01,                   // Class: Mass storage controller
        0x00,                   // Cache line size
        0x00,                   // Latency timer
        0x00,                   // Header type: Standard device
        0x00,                   // BIST
        
        // Base Address Registers
        0x00, 0x00, 0x00, 0x00, // BAR0: Not used
        0x00, 0x00, 0x00, 0x00, // BAR1: Not used  
        0x00, 0x00, 0x00, 0x00, // BAR2: Not used
        0x00, 0x00, 0x00, 0x00, // BAR3: Not used
        0x00, 0x00, 0x00, 0x00, // BAR4: Not used
        0x00, 0x00, 0xBF, 0xFE, // BAR5: AHCI Memory Space (0xFEBF0000)
        
        // CardBus CIS Pointer
        0x00, 0x00, 0x00, 0x00,
        
        // Subsystem vendor/device ID
        0x86, 0x80, 0x02, 0x26,
        
        // Expansion ROM base address
        0x00, 0x00, 0x00, 0x00,
        
        // Capabilities pointer, reserved
        0x80, 0x00, 0x00, 0x00,
        
        // Reserved
        0x00, 0x00, 0x00, 0x00,
        
        // Interrupt line/pin, Min_Gnt, Max_Lat
        0x00, 0x01, 0x00, 0x00,
        
        // Capability: Power Management (0x40-0x47)
        0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
        // Capability: MSI (0x48-0x5F) - 64-bit addressing  
        0x05, 0x70, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        // Capability: MSI-X (0x70-0x7F)
        0x11, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        
        // Fill rest with zeros (0x80-0xFF)
        ...new Array(128).fill(0)
    ];
    
    this.pci_bars = [
        undefined,              // BAR0: Not used
        undefined,              // BAR1: Not used
        undefined,              // BAR2: Not used
        undefined,              // BAR3: Not used
        undefined,              // BAR4: Not used  
        { size: AHCI_MEM_SIZE } // BAR5: AHCI Memory Space
    ];
    
    // Register with PCI subsystem
    this.cpu.devices.pci.register_device(this);
};

/**
 * Initialize memory-mapped I/O regions
 */
AHCIController.prototype.init_mmio = function() {
    // Register MMIO handlers for AHCI register space
    this.cpu.io.mmap_register(AHCI_MEM_ADDRESS, AHCI_MEM_SIZE,
        // Read handler
        (addr) => {
            return this.read_hba_register(addr - AHCI_MEM_ADDRESS);
        },
        // Write handler
        (addr, value) => {
            this.write_hba_register(addr - AHCI_MEM_ADDRESS, value);
        }
    );
};

/**
 * Initialize SMP support and shared memory regions
 */
AHCIController.prototype.init_smp_support = function() {
    // Check if SMP is enabled (if SharedArrayBuffer is available)
    this.smp_enabled = typeof SharedArrayBuffer !== 'undefined' && 
                       typeof this.cpu.shared_memory !== 'undefined';
    
    if (this.smp_enabled) {
        dbg_log("AHCI: SMP support enabled with SharedArrayBuffer", LOG_DISK);
        this.init_shared_memory_regions();
    } else {
        dbg_log("AHCI: Running in single-CPU mode", LOG_DISK);
    }
    
    // Initialize per-CPU command slot allocation
    this.cpu_slot_allocation = new Array(8).fill(0);  // Support up to 8 CPUs
    this.cpu_id = this.cpu.cpu_id || 0;  // Default to CPU 0 if not SMP
};

/**
 * Initialize shared memory regions for SMP operation
 */
AHCIController.prototype.init_shared_memory_regions = function() {
    // In a real implementation, these would be allocated in the SharedArrayBuffer
    // For now, we simulate the layout for compatibility
    this.shared_command_lists = new Uint32Array(AHCI_MAX_PORTS * AHCI_MAX_CMDS * 8);
    this.shared_fis_buffers = new Uint8Array(AHCI_MAX_PORTS * AHCI_FIS_SIZE);
    this.shared_slot_status = new Int32Array(AHCI_MAX_PORTS * AHCI_MAX_CMDS);
    
    dbg_log("AHCI: Shared memory regions initialized", LOG_DISK);
};

/**
 * Initialize default virtual disks for ports
 */
AHCIController.prototype.init_default_disks = function() {
    // Create default RAM disk for port 0 (primary drive)
    this.disk_manager.create_disk(0, "ram", {
        size: 1024 * 1024 * 1024,  // 1GB
    });
    
    // Create smaller RAM disk for port 1 if needed
    if (this.num_ports > 1) {
        this.disk_manager.create_disk(1, "ram", {
            size: 512 * 1024 * 1024,  // 512MB
        });
    }
    
    // Connect disks to command processors
    for (let i = 0; i < this.num_ports; i++) {
        const disk = this.disk_manager.get_disk(i);
        if (disk && this.ports[i].cmd_processor) {
            this.ports[i].cmd_processor.virtual_disk = disk;
            this.ports[i].cmd_processor.disk_size = disk.size;
        }
    }
    
    dbg_log("AHCI: Initialized default virtual disks", LOG_DISK);
};

/**
 * Read from HBA registers
 * @param {number} offset - Register offset within AHCI MMIO space
 * @returns {number} Register value
 */
AHCIController.prototype.read_hba_register = function(offset) {
    // Global HBA registers
    if (offset < 0x100) {
        switch (offset) {
            case HBA_CAP:     return this.cap;
            case HBA_GHC:     return this.ghc; 
            case HBA_IS:      return this.is;
            case HBA_PI:      return this.pi;
            case HBA_VS:      return this.vs;
            case HBA_CCC_CTL: return this.ccc_ctl;
            case HBA_CCC_PORTS: return this.ccc_ports;
            case HBA_EM_LOC:  return this.em_loc;
            case HBA_EM_CTL:  return this.em_ctl;
            case HBA_CAP2:    return this.cap2;
            case HBA_BOHC:    return this.bohc;
            default:
                dbg_log("AHCI: Unknown HBA register read at offset " + h(offset), LOG_DISK);
                return 0;
        }
    }
    
    // Port registers (0x100 + port_num * 0x80)
    const port_num = (offset - 0x100) >> 7;  // Divide by 0x80
    const port_offset = (offset - 0x100) & 0x7F;  // Modulo 0x80
    
    if (port_num >= this.num_ports) {
        dbg_log("AHCI: Invalid port " + port_num + " register read", LOG_DISK);
        return 0;
    }
    
    return this.ports[port_num].read_register(port_offset);
};

/**
 * Write to HBA registers
 * @param {number} offset - Register offset within AHCI MMIO space  
 * @param {number} value - Value to write
 */
AHCIController.prototype.write_hba_register = function(offset, value) {
    // Global HBA registers
    if (offset < 0x100) {
        switch (offset) {
            case HBA_CAP:
                // Read-only register
                dbg_log("AHCI: Attempt to write read-only CAP register", LOG_DISK);
                break;
                
            case HBA_GHC:
                this.write_global_host_control(value);
                break;
                
            case HBA_IS:
                // Write 1 to clear interrupt status bits
                this.is &= ~value;
                this.update_global_interrupt();
                break;
                
            case HBA_PI:
                // Read-only register
                dbg_log("AHCI: Attempt to write read-only PI register", LOG_DISK);
                break;
                
            case HBA_VS:
                // Read-only register  
                dbg_log("AHCI: Attempt to write read-only VS register", LOG_DISK);
                break;
                
            case HBA_CCC_CTL:
                this.ccc_ctl = value;
                break;
                
            case HBA_CCC_PORTS:
                this.ccc_ports = value;
                break;
                
            case HBA_EM_LOC:
                this.em_loc = value;
                break;
                
            case HBA_EM_CTL:
                this.em_ctl = value;
                break;
                
            case HBA_CAP2:
                // Read-only register
                dbg_log("AHCI: Attempt to write read-only CAP2 register", LOG_DISK);
                break;
                
            case HBA_BOHC:
                this.bohc = value;
                break;
                
            default:
                dbg_log("AHCI: Unknown HBA register write at offset " + h(offset) + " value " + h(value), LOG_DISK);
                break;
        }
        return;
    }
    
    // Port registers (0x100 + port_num * 0x80)
    const port_num = (offset - 0x100) >> 7;  // Divide by 0x80
    const port_offset = (offset - 0x100) & 0x7F;  // Modulo 0x80
    
    if (port_num >= this.num_ports) {
        dbg_log("AHCI: Invalid port " + port_num + " register write", LOG_DISK);
        return;
    }
    
    this.ports[port_num].write_register(port_offset, value);
};

/**
 * Handle Global Host Control register writes
 * @param {number} value - Value written to GHC register
 */
AHCIController.prototype.write_global_host_control = function(value) {
    const old_ghc = this.ghc;
    
    // Handle HBA Reset
    if (value & GHC_HR) {
        dbg_log("AHCI: HBA Reset requested", LOG_DISK);
        this.reset_hba();
        return;
    }
    
    // Update register value
    this.ghc = (value & ~GHC_HR) | GHC_AE;  // Always keep AHCI enabled
    
    // Handle interrupt enable/disable
    if ((this.ghc & GHC_IE) && !(old_ghc & GHC_IE)) {
        dbg_log("AHCI: Global interrupts enabled", LOG_DISK);
        this.update_global_interrupt();
    } else if (!(this.ghc & GHC_IE) && (old_ghc & GHC_IE)) {
        dbg_log("AHCI: Global interrupts disabled", LOG_DISK);
        this.clear_global_interrupt();
    }
};

/**
 * Reset the entire HBA to initial state
 */
AHCIController.prototype.reset_hba = function() {
    dbg_log("AHCI: Performing HBA reset", LOG_DISK);
    
    // Reset global registers
    this.ghc = GHC_AE;  // Keep AHCI enabled
    this.is = 0;
    this.ccc_ctl = 0;
    this.ccc_ports = 0;
    this.em_ctl = 0;
    this.bohc = 0;
    
    // Reset all ports
    for (let i = 0; i < this.num_ports; i++) {
        this.ports[i].reset();
    }
    
    // Clear global interrupt
    this.clear_global_interrupt();
};

/**
 * Update global interrupt status and deliver if needed
 */
AHCIController.prototype.update_global_interrupt = function() {
    if (!(this.ghc & GHC_IE) || this.is === 0) {
        return;  // Interrupts disabled or no pending interrupts
    }
    
    // Deliver MSI interrupt or raise PCI interrupt
    this.deliver_interrupt();
};

/**
 * Clear global interrupt
 */
AHCIController.prototype.clear_global_interrupt = function() {
    // Lower PCI interrupt line  
    if (this.cpu.devices && this.cpu.devices.pci) {
        this.cpu.devices.pci.lower_irq(this.pci_id);
    }
};

/**
 * Deliver interrupt via MSI or legacy PCI
 */
AHCIController.prototype.deliver_interrupt = function() {
    // Use MSI manager to deliver interrupts efficiently
    if (this.msi_manager) {
        // Find which port triggered the interrupt
        for (let port = 0; port < this.num_ports; port++) {
            if (this.is & (1 << port)) {
                this.msi_manager.deliver_port_interrupt(port);
                break;  // Only deliver first port interrupt for now
            }
        }
    } else {
        // Fallback to legacy PCI interrupt
        if (this.cpu.devices && this.cpu.devices.pci) {
            this.cpu.devices.pci.raise_irq(this.pci_id);
        }
    }
};

/**
 * AHCI Port implementation
 * @constructor
 * @param {AHCIController} controller - Parent AHCI controller
 * @param {number} port_num - Port number (0-31)
 */
function AHCIPort(controller, port_num) {
    this.controller = controller;
    this.port_num = port_num;
    
    // Port registers
    this.clb = 0;           // Command List Base Address
    this.clbu = 0;          // Command List Base Address Upper
    this.fb = 0;            // FIS Base Address  
    this.fbu = 0;           // FIS Base Address Upper
    this.is = 0;            // Interrupt Status
    this.ie = 0;            // Interrupt Enable
    this.cmd = 0;           // Command and Status
    this.tfd = 0;           // Task File Data
    this.sig = 0;           // Signature
    this.ssts = 0;          // SATA Status
    this.sctl = 0;          // SATA Control
    this.serr = 0;          // SATA Error
    this.sact = 0;          // SATA Active
    this.ci = 0;            // Command Issue
    this.sntf = 0;          // SATA Notification
    
    // Command tracking
    this.running_commands = new Array(AHCI_MAX_CMDS).fill(null);
    this.command_timeout_id = new Array(AHCI_MAX_CMDS).fill(null);
    
    // Command processor for SATA protocol handling
    this.cmd_processor = new AHCICommandProcessor(controller, port_num);
    
    // Initialize port
    this.reset();
    
    dbg_log("AHCI Port " + port_num + " initialized", LOG_DISK);
}

/**
 * Reset port to initial state
 */
AHCIPort.prototype.reset = function() {
    // Stop any running operations
    this.cmd &= ~(CMD_ST | CMD_FRE | CMD_CR | CMD_FR);
    
    // Clear interrupts and errors
    this.is = 0;
    this.serr = 0;
    this.ci = 0;
    this.sact = 0;
    
    // Set initial SATA status (device detected and active)
    this.ssts = 0x113;  // Device present, 1.5 Gbps, interface active
    this.sig = SIG_ATA; // ATA signature
    
    // Set task file to ready state
    this.tfd = 0x50;    // Drive ready, seek complete
    
    // Cancel any pending commands
    for (let i = 0; i < AHCI_MAX_CMDS; i++) {
        if (this.command_timeout_id[i]) {
            clearTimeout(this.command_timeout_id[i]);
            this.command_timeout_id[i] = null;
        }
        this.running_commands[i] = null;
    }
    
    dbg_log("AHCI Port " + this.port_num + " reset", LOG_DISK);
};

/**
 * Read from port register
 * @param {number} offset - Register offset within port space
 * @returns {number} Register value
 */
AHCIPort.prototype.read_register = function(offset) {
    switch (offset) {
        case PORT_CLB:   return this.clb;
        case PORT_CLBU:  return this.clbu;
        case PORT_FB:    return this.fb;
        case PORT_FBU:   return this.fbu;
        case PORT_IS:    return this.is;
        case PORT_IE:    return this.ie;
        case PORT_CMD:   return this.cmd;
        case PORT_TFD:   return this.tfd;
        case PORT_SIG:   return this.sig;
        case PORT_SSTS:  return this.ssts;
        case PORT_SCTL:  return this.sctl;
        case PORT_SERR:  return this.serr;
        case PORT_SACT:  return this.sact;
        case PORT_CI:    return this.ci;
        case PORT_SNTF:  return this.sntf;
        default:
            dbg_log("AHCI Port " + this.port_num + ": Unknown register read at offset " + h(offset), LOG_DISK);
            return 0;
    }
};

/**
 * Write to port register  
 * @param {number} offset - Register offset within port space
 * @param {number} value - Value to write
 */
AHCIPort.prototype.write_register = function(offset, value) {
    switch (offset) {
        case PORT_CLB:
            this.clb = value & 0xFFFFFC00;  // 1KB aligned
            break;
            
        case PORT_CLBU:
            this.clbu = value;
            break;
            
        case PORT_FB:
            this.fb = value & 0xFFFFFF00;   // 256-byte aligned
            break;
            
        case PORT_FBU:
            this.fbu = value;
            break;
            
        case PORT_IS:
            // Write 1 to clear
            this.is &= ~value;
            this.update_port_interrupt();
            break;
            
        case PORT_IE:
            this.ie = value;
            this.update_port_interrupt();
            break;
            
        case PORT_CMD:
            this.write_command_register(value);
            break;
            
        case PORT_TFD:
            // Read-only register
            dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only TFD register", LOG_DISK);
            break;
            
        case PORT_SIG:
            // Read-only register
            dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only SIG register", LOG_DISK);
            break;
            
        case PORT_SSTS:
            // Read-only register  
            dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only SSTS register", LOG_DISK);
            break;
            
        case PORT_SCTL:
            this.sctl = value;
            this.handle_sata_control(value);
            break;
            
        case PORT_SERR:
            // Write 1 to clear
            this.serr &= ~value;
            break;
            
        case PORT_SACT:
            // Set SATA Active for NCQ commands
            this.sact |= value;
            break;
            
        case PORT_CI:
            // Issue new commands
            this.issue_commands(value);
            break;
            
        case PORT_SNTF:
            // Write 1 to clear
            this.sntf &= ~value;
            break;
            
        default:
            dbg_log("AHCI Port " + this.port_num + ": Unknown register write at offset " + 
                   h(offset) + " value " + h(value), LOG_DISK);
            break;
    }
};

/**
 * Handle Command and Status register writes
 * @param {number} value - New CMD register value
 */
AHCIPort.prototype.write_command_register = function(value) {
    const old_cmd = this.cmd;
    
    // Handle Start (ST) bit
    if ((value & CMD_ST) && !(old_cmd & CMD_ST)) {
        // Start command processing
        if (this.clb || this.clbu) {
            this.cmd |= CMD_CR;  // Set Command List Running
            dbg_log("AHCI Port " + this.port_num + ": Command processing started", LOG_DISK);
        }
    } else if (!(value & CMD_ST) && (old_cmd & CMD_ST)) {
        // Stop command processing
        this.cmd &= ~CMD_CR;
        dbg_log("AHCI Port " + this.port_num + ": Command processing stopped", LOG_DISK);
    }
    
    // Handle FIS Receive Enable (FRE) bit
    if ((value & CMD_FRE) && !(old_cmd & CMD_FRE)) {
        // Start FIS processing
        if (this.fb || this.fbu) {
            this.cmd |= CMD_FR;  // Set FIS Receive Running
            dbg_log("AHCI Port " + this.port_num + ": FIS processing started", LOG_DISK);
        }
    } else if (!(value & CMD_FRE) && (old_cmd & CMD_FRE)) {
        // Stop FIS processing
        this.cmd &= ~CMD_FR;
        dbg_log("AHCI Port " + this.port_num + ": FIS processing stopped", LOG_DISK);
    }
    
    // Update command register (preserve running status bits)
    this.cmd = (this.cmd & (CMD_CR | CMD_FR)) | (value & ~(CMD_CR | CMD_FR));
};

/**
 * Handle SATA Control register writes
 * @param {number} value - SCTL register value
 */
AHCIPort.prototype.handle_sata_control = function(value) {
    const det = value & 0xF;  // Device Detection Control
    
    switch (det) {
        case 0:  // No device detection/initialization
            break;
        case 1:  // Perform device detection and initialization
            // Simulate device detection
            this.ssts = 0x113;  // Device present, 1.5 Gbps, interface active
            this.sig = SIG_ATA;
            dbg_log("AHCI Port " + this.port_num + ": SATA device detected", LOG_DISK);
            break;
        case 4:  // Disable SATA interface  
            this.ssts = 0;
            this.sig = 0xFFFFFFFF;
            dbg_log("AHCI Port " + this.port_num + ": SATA interface disabled", LOG_DISK);
            break;
    }
};

/**
 * Issue new commands from Command Issue register
 * @param {number} ci_mask - Mask of command slots to issue  
 */
AHCIPort.prototype.issue_commands = function(ci_mask) {
    if (!(this.cmd & CMD_ST)) {
        dbg_log("AHCI Port " + this.port_num + ": Commands issued but ST bit not set", LOG_DISK);
        return;
    }
    
    // Find newly issued commands
    const new_commands = ci_mask & ~this.ci;
    
    for (let slot = 0; slot < AHCI_MAX_CMDS; slot++) {
        if (new_commands & (1 << slot)) {
            // Check if slot is properly allocated through SMP memory manager
            if (this.controller.smp_memory_manager) {
                const allocated = this.controller.smp_memory_manager.try_allocate_slot(slot);
                if (!allocated) {
                    dbg_log("AHCI Port " + this.port_num + ": Slot " + slot + " already allocated", LOG_DISK);
                    continue;
                }
            }
            
            this.process_command_slot(slot);
        }
    }
    
    // Update Command Issue register
    this.ci |= new_commands;
};

/**
 * Process a specific command slot
 * @param {number} slot - Command slot number (0-31)
 */
AHCIPort.prototype.process_command_slot = function(slot) {
    dbg_log("AHCI Port " + this.port_num + ": Processing command slot " + slot, LOG_DISK);
    
    // Mark command as running
    this.running_commands[slot] = {
        start_time: Date.now(),
        slot: slot
    };
    
    // Process command through SATA protocol handler
    this.cmd_processor.process_command(slot).catch(error => {
        dbg_log("AHCI Port " + this.port_num + ": Error in command slot " + slot + ": " + error.message, LOG_DISK);
        this.complete_command(slot);
    });
};

/**
 * Complete a command and generate interrupt
 * @param {number} slot - Command slot that completed
 */
AHCIPort.prototype.complete_command = function(slot) {
    dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed", LOG_DISK);
    
    // Clear command from issue register
    this.ci &= ~(1 << slot);
    
    // Clear from SATA Active if it was an NCQ command
    this.sact &= ~(1 << slot);
    
    // Release slot through SMP memory manager
    if (this.controller.smp_memory_manager) {
        this.controller.smp_memory_manager.release_command_slot(slot);
    }
    
    // Clear timeout
    if (this.command_timeout_id[slot]) {
        clearTimeout(this.command_timeout_id[slot]);
        this.command_timeout_id[slot] = null;
    }
    
    this.running_commands[slot] = null;
    
    // Set interrupt status
    this.is |= PORT_IRQ_DHRS;  // D2H Register FIS received
    
    // Update port interrupt
    this.update_port_interrupt();
};

/**
 * Update port interrupt status and propagate to HBA
 */
AHCIPort.prototype.update_port_interrupt = function() {
    const pending_interrupts = this.is & this.ie;
    
    if (pending_interrupts) {
        // Set port interrupt in HBA interrupt status
        this.controller.is |= (1 << this.port_num);
        this.controller.update_global_interrupt();
    } else {
        // Clear port interrupt in HBA interrupt status  
        this.controller.is &= ~(1 << this.port_num);
        
        // Check if any other ports have interrupts
        if (this.controller.is === 0) {
            this.controller.clear_global_interrupt();
        }
    }
};

/**
 * Get port state for save/restore
 */
AHCIPort.prototype.get_state = function() {
    return {
        clb: this.clb,
        clbu: this.clbu,
        fb: this.fb,
        fbu: this.fbu,
        is: this.is,
        ie: this.ie,
        cmd: this.cmd,
        tfd: this.tfd,
        sig: this.sig,
        ssts: this.ssts,
        sctl: this.sctl,
        serr: this.serr,
        sact: this.sact,
        ci: this.ci,
        sntf: this.sntf,
        running_commands: this.running_commands.slice(),
        cmd_processor: this.cmd_processor ? this.cmd_processor.get_state() : null,
    };
};

/**
 * Set port state for save/restore
 */
AHCIPort.prototype.set_state = function(state) {
    this.clb = state.clb;
    this.clbu = state.clbu;
    this.fb = state.fb;
    this.fbu = state.fbu;
    this.is = state.is;
    this.ie = state.ie;
    this.cmd = state.cmd;
    this.tfd = state.tfd;
    this.sig = state.sig;
    this.ssts = state.ssts;
    this.sctl = state.sctl;
    this.serr = state.serr;
    this.sact = state.sact;
    this.ci = state.ci;
    this.sntf = state.sntf;
    this.running_commands = state.running_commands || new Array(AHCI_MAX_CMDS).fill(null);
    
    // Restore command processor state
    if (state.cmd_processor && this.cmd_processor) {
        this.cmd_processor.set_state(state.cmd_processor);
    }
    
    // Cancel any existing timeouts and recreate them if needed
    for (let i = 0; i < AHCI_MAX_CMDS; i++) {
        if (this.command_timeout_id[i]) {
            clearTimeout(this.command_timeout_id[i]);
            this.command_timeout_id[i] = null;
        }
    }
};

/**
 * Get AHCI Controller state for save/restore
 */
AHCIController.prototype.get_state = function() {
    return {
        // HBA global registers
        cap: this.cap,
        ghc: this.ghc,
        is: this.is,
        pi: this.pi,
        vs: this.vs,
        ccc_ctl: this.ccc_ctl,
        ccc_ports: this.ccc_ports,
        em_loc: this.em_loc,
        em_ctl: this.em_ctl,
        cap2: this.cap2,
        bohc: this.bohc,
        
        // Ports state
        ports: this.ports.map(port => port.get_state()),
        num_ports: this.num_ports,
        
        // SMP state
        cpu_slot_allocation: this.cpu_slot_allocation,
        cpu_id: this.cpu_id,
        smp_enabled: this.smp_enabled,
        
        // SMP managers state
        smp_memory_manager: this.smp_memory_manager ? this.smp_memory_manager.get_memory_stats() : null,
        dma_manager: this.dma_manager ? this.dma_manager.get_dma_stats() : null,
        msi_manager: this.msi_manager ? this.msi_manager.get_state() : null,
        disk_manager: this.disk_manager ? this.disk_manager.get_stats() : null,
    };
};

/**
 * Set AHCI Controller state for save/restore
 */
AHCIController.prototype.set_state = function(state) {
    // Restore HBA global registers
    this.cap = state.cap;
    this.ghc = state.ghc;
    this.is = state.is;
    this.pi = state.pi;
    this.vs = state.vs;
    this.ccc_ctl = state.ccc_ctl;
    this.ccc_ports = state.ccc_ports;
    this.em_loc = state.em_loc;
    this.em_ctl = state.em_ctl;
    this.cap2 = state.cap2;
    this.bohc = state.bohc;
    
    // Restore ports
    this.num_ports = state.num_ports || 4;
    for (let i = 0; i < this.num_ports; i++) {
        if (state.ports && state.ports[i]) {
            this.ports[i].set_state(state.ports[i]);
        }
    }
    
    // Restore SMP state
    this.cpu_slot_allocation = state.cpu_slot_allocation || new Array(8).fill(0);
    this.cpu_id = state.cpu_id || 0;
    this.smp_enabled = state.smp_enabled || false;
    
    // Re-initialize SMP managers if they don't exist
    if (!this.smp_memory_manager) {
        this.smp_memory_manager = new AHCISMPMemoryManager(this.cpu, this.cpu.shared_memory);
    }
    if (!this.dma_manager) {
        this.dma_manager = new AHCIDMAManager(this.smp_memory_manager, this.cpu);
    }
    if (!this.msi_manager) {
        this.msi_manager = new AHCIMSIManager(this);
        // Restore MSI manager state
        if (state.msi_manager) {
            this.msi_manager.set_state(state.msi_manager);
        }
    }
    if (!this.disk_manager) {
        this.disk_manager = new VirtualDiskManager();
        // Re-initialize default disks
        this.init_default_disks();
    }
};

export { AHCIController };
