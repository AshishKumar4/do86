const fs = require('fs');
const start = Date.now();
const elapsed = () => (Date.now() - start) + 'ms';

// Hook into WebAssembly to measure compile time
const origInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = function(buf, imports) {
  console.log('['+elapsed()+'] WebAssembly.instantiate called, buffer size:', buf.byteLength || 'stream');
  const result = origInstantiate.call(this, buf, imports);
  result.then(() => console.log('['+elapsed()+'] WebAssembly.instantiate DONE'));
  return result;
};

global.Module = {
  noInitialRun: true,
  print: (s) => console.log('[QEMU]', s),
  printErr: (s) => console.error('[QEMU-ERR]', s),
  monitorRunDependencies(n) {
    console.log('['+elapsed()+'] runDependencies =', n);
  },
  onRuntimeInitialized() {
    console.log('['+elapsed()+'] onRuntimeInitialized!');
    try {
      Module.FS.mkdir('/bios');
      Module.FS.writeFile('/bios/bios-256k.bin', fs.readFileSync('/workspace/qemu/pc-bios/bios-256k.bin'));
      console.log('['+elapsed()+'] calling main...');
      Module.callMain(['-M','pc','-m','32M','-L','/bios','-nographic','-serial','stdio','-vga','none']);
      console.log('['+elapsed()+'] callMain returned');
    } catch(e) { console.error('ERROR:', e.message, e.stack); }
  },
  onAbort: w => console.log('['+elapsed()+'] ABORT:', w),
  locateFile: f => '/workspace/qemu/build-wasm/' + f,
};

console.log('['+elapsed()+'] requiring module...');
require('/workspace/qemu/build-wasm/qemu-system-i386.js');
console.log('['+elapsed()+'] require returned, waiting for init...');

setInterval(() => {}, 10);
setTimeout(() => { console.log('['+elapsed()+'] TIMEOUT'); process.exit(0); }, 90000);
