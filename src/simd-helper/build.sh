#!/bin/bash
# Build the SIMD helper WASM module and copy to src/
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release
cp target/wasm32-unknown-unknown/release/simd_helper.wasm ../simd_helper.wasm
echo "Built simd_helper.wasm ($(wc -c < ../simd_helper.wasm) bytes)"
