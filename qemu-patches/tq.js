const fs = require('fs');
const start = Date.now();
global.Module = {
  noInitialRun: true,
  print: console.log,
  printErr: console.error,
  onRuntimeInitialized() {
    console.log('READY at', (Date.now()-start), 'ms');
    Module.FS.mkdir('/bios');
    Module.FS.writeFile('/bios/bios-256k.bin', fs.readFileSync('/workspace/qemu/pc-bios/bios-256k.bin'));
    Module.callMain(['-M','pc','-m','32M','-L','/bios','-nographic','-serial','stdio','-vga','none']);
    console.log('callMain returned');
  },
  onAbort: w => console.log('ABORT:', w),
  locateFile: f => '/workspace/qemu/build-wasm/' + f,
};
require('/workspace/qemu/build-wasm/qemu-system-i386.js');
setInterval(() => {}, 10);
setTimeout(() => { console.log('timeout'); process.exit(0); }, 60000);
