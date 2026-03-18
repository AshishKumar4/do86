declare module "v86" {
  interface V86Options {
    wasm_fn?: (env: any) => Promise<any>;
    wasm_path?: string;
    bios?: { buffer: ArrayBuffer; url?: string };
    vga_bios?: { buffer: ArrayBuffer; url?: string };
    cdrom?: { buffer: ArrayBuffer; url?: string };
    hda?: { buffer: ArrayBuffer; url?: string } | any;
    hdb?: { buffer: ArrayBuffer; url?: string } | any;
    fda?: { buffer: ArrayBuffer; url?: string };
    fdb?: { buffer: ArrayBuffer; url?: string };
    bzimage?: { buffer: ArrayBuffer; url?: string };
    initrd?: { buffer: ArrayBuffer; url?: string };
    initial_state?: { buffer: ArrayBuffer; url?: string };
    cmdline?: string;
    memory_size?: number;
    vga_memory_size?: number;
    autostart?: boolean;
    disable_jit?: boolean;
    disable_keyboard?: boolean;
    disable_mouse?: boolean;
    disable_speaker?: boolean;
    screen_container?: any;
    serial_container?: any;
    network_relay_url?: string;
    filesystem?: any;
    log_level?: number;
    acpi?: boolean;
    fastboot?: boolean;
    boot_order?: number;
    net_device?: any;
    /** Number of virtual CPUs to expose (SMP). 1 = single-core, up to 8.
     *  Requires the extended v86-extensions.wasm with SMP WASM exports. */
    cpu_count?: number;
  }

  export class V86 {
    constructor(options: V86Options);
    run(): void;
    stop(): Promise<void>;
    destroy(): Promise<void>;
    restart(): void;
    is_running(): boolean;
    serial0_send(data: string): void;
    serial_send_bytes(port: number, data: Uint8Array): void;
    keyboard_send_scancodes(codes: number[]): void;
    keyboard_send_text(text: string): void;
    add_listener(event: string, callback: (...args: any[]) => void): void;
    remove_listener(event: string, callback: (...args: any[]) => void): void;
    save_state(): Promise<ArrayBuffer>;
    restore_state(state: ArrayBuffer): Promise<void>;
    create_file(path: string, data: Uint8Array): Promise<void>;
    read_file(path: string): Promise<Uint8Array>;
    screen_adapter: any;
    screen_make_screenshot(): any;
    bus: {
      send(event: string, data: any): void;
      register(event: string, callback: (...args: any[]) => void, context?: any): void;
    };
    emulator_bus: {
      send(event: string, data: any): void;
      register(event: string, callback: (...args: any[]) => void, context?: any): void;
    };
    v86: {
      cpu: {
        wasm_memory: WebAssembly.Memory;
        devices: {
          vga: {
            screen: any;
            graphical_mode: boolean;
            screen_width: number;
            screen_height: number;
            virtual_width: number;
            virtual_height: number;
            svga_enabled: boolean;
            svga_bpp: number;
            image_data: any;
            dest_buffet_offset: number;
            screen_fill_buffer(): void;
            layers: any[];
          };
        };
      };
      run(): void;
      stop(): void;
      init(settings: any): void;
    };
  }
}
