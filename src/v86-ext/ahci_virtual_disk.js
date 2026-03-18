/**
 * AHCI Virtual Disk Management
 * 
 * This module provides virtual disk management for AHCI, including integration
 * with Durable Objects for persistent storage in a Cloudflare Workers environment.
 */

import { LOG_DISK } from "./const.js";
import { h } from "./lib.js";
import { dbg_assert, dbg_log } from "./log.js";

// Virtual disk types
export const DISK_TYPE_RAM = "ram";           // In-memory disk (non-persistent)
export const DISK_TYPE_DURABLE = "durable";   // Durable Object storage  
export const DISK_TYPE_FILE = "file";         // File-based (for Node.js)
export const DISK_TYPE_BUFFER = "buffer";     // Provided buffer

// Disk geometry constants
export const SECTOR_SIZE = 512;
export const SECTORS_PER_TRACK = 63;
export const HEADS_PER_CYLINDER = 16;
export const DEFAULT_DISK_SIZE = 1024 * 1024 * 1024; // 1GB

/**
 * Virtual Disk Interface
 * 
 * Abstract base class for all virtual disk types
 */
export class VirtualDisk {
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
export class RAMVirtualDisk extends VirtualDisk {
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
export class BufferVirtualDisk extends VirtualDisk {
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
export class DurableObjectVirtualDisk extends VirtualDisk {
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
export class VirtualDiskManager {
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

export { 
    VirtualDisk, 
    RAMVirtualDisk, 
    BufferVirtualDisk, 
    DurableObjectVirtualDisk, 
    VirtualDiskManager 
};