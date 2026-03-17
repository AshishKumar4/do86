declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "*.cjs" {
  const text: string;
  export default text;
}
