#!/usr/bin/env python3
"""Split a VM disk image into fixed-size chunks for v86's `use_parts` loader.

GitHub Pages gzips .iso files, which breaks byte-range requests, and a desktop image
is too big to download up front. v86 instead fetches `<name>-<start>-<end>.iso` chunks
as the guest reads them. Writes the chunks plus info.json ({size, chunk, sha256}),
which public/vm.js reads to offer the image.

    python3 scripts/split-vm-image.py image.iso public/vendor/v86/debian --name debian
"""
import argparse, hashlib, json, pathlib

p = argparse.ArgumentParser()
p.add_argument("image", type=pathlib.Path)
p.add_argument("output", type=pathlib.Path)
p.add_argument("--name", default="debian")
p.add_argument("--chunk", type=int, default=2 * 1024 * 1024)
args = p.parse_args()
digest = hashlib.sha256()
with args.image.open("rb") as f:
    while block := f.read(1 << 20):
        digest.update(block)
# Chunks go in a folder named after the image's hash, so browsers never mix cached
# chunks of an old build with a new one (Pages caches files for 10 minutes).
version = digest.hexdigest()[:12]
chunks = args.output / version
chunks.mkdir(parents=True, exist_ok=True)
size = 0
with args.image.open("rb") as f:
    while block := f.read(args.chunk):
        (chunks / f"{args.name}-{size}-{size + args.chunk}.iso").write_bytes(block)
        size += len(block)
info = {"size": size, "chunk": args.chunk, "sha256": digest.hexdigest(), "dir": version}
(args.output / "info.json").write_text(json.dumps(info))
print(f"{args.image.name}: {size / 1e6:.0f} MB in {-(-size // args.chunk)} chunks -> {chunks}")
