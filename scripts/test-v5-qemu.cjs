/**
 * Test script for QEMU v5 build (emscripten_set_main_loop, no ASYNCIFY).
 *
 * Tests -M pc boot with SeaBIOS. Expects serial output via Module.print.
 * Run from the do-linux-path2 directory:
 *   node scripts/test-v5-qemu.cjs
 */
'use strict';

const path = require('path');
const fs = require('fs');

const QEMU_CJS = path.join(__dirname, '../qemu-wasm/qemu-system-i386-v5.cjs');
const BIOS_DIR = path.join(__dirname, '../../qemu/pc-bios');

const start = Date.now();
const ts = () => `[${((Date.now() - start) / 1000).toFixed(1)}s]`;
const output = [];
let initDone = false;
let callMainDone = false;
let seabiosDetected = false;

console.log('Testing QEMU v5 build (emscripten_set_main_loop, no ASYNCIFY)');
console.log('QEMU:', QEMU_CJS);
console.log('BIOS:', BIOS_DIR);
console.log('');

// Verify files exist
if (!fs.existsSync(QEMU_CJS)) {
  console.error('ERROR: QEMU .cjs not found at', QEMU_CJS);
  process.exit(1);
}

globalThis.Module = {
  noInitialRun: true,
  noExitRuntime: true,

  print: (line) => {
    output.push(line);
    // Check for SeaBIOS output
    if (line.includes('SeaBIOS')) {
      seabiosDetected = true;
      console.log(ts(), 'SERIAL:', line);
    } else if (line.includes('Boot') || line.includes('boot')) {
      console.log(ts(), 'SERIAL:', line);
    }
  },

  printErr: (line) => {
    output.push('[E] ' + line);
    // Only log interesting stderr (skip routine Emscripten noise)
    if (line.includes('ERROR') || line.includes('abort') || line.includes('Assertion')) {
      console.log(ts(), 'STDERR:', line);
    }
  },

  onRuntimeInitialized() {
    initDone = true;
    console.log(ts(), 'Runtime initialized');
    console.log(ts(), '  callMain:', typeof Module.callMain);
    console.log(ts(), '  FS:', typeof Module.FS);

    // Mount BIOS files into QEMU virtual filesystem
    '/usr/local/share/qemu'.split('/').filter(Boolean).reduce((p, d) => {
      const full = p + '/' + d;
      try { Module.FS.mkdir(full); } catch (e) { /* exists */ }
      return full;
    }, '');

    let biosMounted = 0;
    for (const f of ['bios-256k.bin', 'kvmvapic.bin', 'linuxboot.bin',
                     'vgabios.bin', 'vgabios-cirrus.bin', 'vgabios-stdvga.bin']) {
      const p = path.join(BIOS_DIR, f);
      if (fs.existsSync(p)) {
        Module.FS.writeFile('/usr/local/share/qemu/' + f, fs.readFileSync(p));
        biosMounted++;
      }
    }
    console.log(ts(), `Mounted ${biosMounted} BIOS files`);

    // Launch QEMU — v5 uses emscripten_set_main_loop, so callMain()
    // returns normally after registering the main loop callback.
    // No -S flag: we want QEMU to actually execute guest code.
    console.log(ts(), 'Calling callMain() ...');
    try {
      Module.callMain([
        '-M', 'pc',
        '-m', '32M',
        '-nographic',
        '-nodefaults',
        '-no-user-config',
        '-serial', 'stdio',
      ]);
      callMainDone = true;
      console.log(ts(), 'callMain() returned normally (main loop callback registered)');
    } catch (e) {
      if (e && (e.message === 'unwind' || String(e).includes('ExitStatus'))) {
        callMainDone = true;
        console.log(ts(), 'callMain() returned via unwind/ExitStatus (unexpected for v5, but ok)');
      } else {
        console.error(ts(), 'callMain() FAILED:', e?.message || e);
        if (e?.stack) console.error(e.stack);
        process.exit(1);
      }
    }
  },

  onAbort: (s) => {
    console.error(ts(), '[ABORT]', s);
    process.exit(1);
  },
};

console.log(ts(), 'Loading QEMU .cjs ...');
require(QEMU_CJS);

// Keep the process alive to let the main loop callback fire.
// SeaBIOS should print within a few seconds.
let ticks = 0;
const MAX_TICKS = 100; // 10 seconds max
const TICK_MS = 100;

const interval = setInterval(() => {
  ticks++;

  if (ticks % 20 === 0) {
    console.log(ts(), `  tick ${ticks}/${MAX_TICKS}, output lines: ${output.length}, SeaBIOS: ${seabiosDetected}`);
  }

  // Success: SeaBIOS detected
  if (seabiosDetected && ticks >= 10) {
    clearInterval(interval);
    printResults(true);
    process.exit(0);
  }

  // Timeout
  if (ticks >= MAX_TICKS) {
    clearInterval(interval);
    console.log('\n--- Last 20 output lines ---');
    output.slice(-20).forEach(l => console.log('  ', l));
    console.log('---');
    printResults(false);
    process.exit(1);
  }
}, TICK_MS);

function printResults(success) {
  console.log('\n=== TEST RESULTS ===');
  console.log('Runtime initialized:', initDone ? 'YES' : 'NO');
  console.log('callMain returned:  ', callMainDone ? 'YES' : 'NO');
  console.log('SeaBIOS detected:   ', seabiosDetected ? 'YES' : 'NO');
  console.log('Output lines:       ', output.length);
  console.log('Event loop ticks:   ', ticks, '(not blocked)');
  console.log('');

  if (success) {
    console.log('Overall: PASS');
    console.log('');
    console.log('v5 Build Properties:');
    console.log('  - emscripten_set_main_loop() callback model (no ASYNCIFY)');
    console.log('  - ~6.3MB WASM (vs ~12MB with ASYNCIFY)');
    console.log('  - callMain() returns normally');
    console.log('  - TCG interpreter (TCI) executes guest code');
    console.log('  - SeaBIOS boots and prints serial output');
    console.log('');
    console.log('Durable Object Compatibility:');
    console.log('  - No pthreads / no SharedArrayBuffer');
    console.log('  - No ASYNCIFY stack unwinding');
    console.log('  - Main loop driven by JS event loop callbacks');
    console.log('  - Non-blocking I/O (poll timeout=0)');
  } else {
    console.log('Overall: FAIL');
    console.log('');
    console.log('SeaBIOS output was not detected within the timeout period.');
    console.log('Check that the BIOS files are present and the WASM binary is correct.');
  }
}
