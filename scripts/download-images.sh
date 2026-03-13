#!/usr/bin/env bash
# Download OS images for v86 emulator (optional for local dev)
#
# In production, the Durable Object fetches images from URLs on first boot
# and caches them in SQLite. This script is only needed if you want local
# copies in public/assets/ for offline development or faster first-boot.
#
# These files are .gitignored because they're too large for git.

set -euo pipefail

ASSETS_DIR="$(cd "$(dirname "$0")/../public/assets" && pwd)"

echo "Downloading OS images to: $ASSETS_DIR"

download() {
  local name="$1" url="$2" expected_type="$3"
  local dest="$ASSETS_DIR/$name"

  if [ -f "$dest" ]; then
    echo "  ✓ $name already exists ($(du -h "$dest" | cut -f1))"
    return 0
  fi

  echo "  ↓ Downloading $name..."
  if curl -fSL -o "$dest.tmp" --connect-timeout 15 --max-time 300 "$url"; then
    # Verify it's a valid image
    local ftype
    ftype=$(file -b "$dest.tmp")
    if echo "$ftype" | grep -qi "$expected_type"; then
      mv "$dest.tmp" "$dest"
      echo "  ✓ $name downloaded ($(du -h "$dest" | cut -f1))"
    else
      rm -f "$dest.tmp"
      echo "  ✗ $name failed validation (got: $ftype)" >&2
      return 1
    fi
  else
    rm -f "$dest.tmp"
    echo "  ✗ $name download failed from $url" >&2
    return 1
  fi
}

echo ""
echo "=== OS Images ==="

# HelenOS 0.5.0 (ia32) - ~18MB microkernel OS
download "helenos.iso" \
  "http://www.helenos.org/releases/HelenOS-0.5.0-ia32.iso" \
  "ISO 9660"

# Damn Small Linux 4.11 RC2 - ~50MB live CD
download "dsl.iso" \
  "https://distro.ibiblio.org/damnsmall/release_candidate/dsl-4.11.rc2.iso" \
  "ISO 9660"

# Linux4 - minimal Linux 4.x text-mode ISO from v86 project - ~7MB
download "linux4.iso" \
  "https://copy.sh/v86/images/linux4.iso" \
  "ISO 9660"

echo ""
echo "=== Verification ==="
for f in kolibri.img helenos.iso dsl.iso linux4.iso seabios.bin vgabios.bin; do
  if [ -f "$ASSETS_DIR/$f" ]; then
    printf "  %-20s %8s  %s\n" "$f" "$(du -h "$ASSETS_DIR/$f" | cut -f1)" "$(file -b "$ASSETS_DIR/$f" | cut -c1-60)"
  else
    printf "  %-20s  MISSING\n" "$f"
  fi
done

echo ""
echo "Done. All images ready for v86 emulation."
