declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "*.mjs" {
  const value: any;
  export default value;
}
