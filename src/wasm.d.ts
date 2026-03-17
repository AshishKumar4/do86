declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

// Emscripten JS glue imported as text string via `with { type: "text" }`.
// Covers .cjs and .js glue files in qemu-wasm/.
declare module "*.cjs" {
  const text: string;
  export default text;
}

// The .js glue file is imported with `{ type: "text" }` attribute,
// which tells the bundler to load it as a raw string rather than
// executing it as a module. TypeScript needs this ambient declaration.
declare module "*qemu-system-i386.js" {
  const text: string;
  export default text;
}
