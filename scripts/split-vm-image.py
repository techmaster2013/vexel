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
args.output.mkdir(parents=True, exist_ok=True)
digest, size = hashlib.sha256(), 0
with args.image.open("rb") as f:
    while block := f.read(args.chunk):
        digest.update(block)
        (args.output / f"{args.name}-{size}-{size + args.chunk}.iso").write_bytes(block)
        size += len(block)
info = {"size": size, "chunk": args.chunk, "sha256": digest.hexdigest()}
(args.output / "info.json").write_text(json.dumps(info))
print(f"{args.image.name}: {size / 1e6:.0f} MB in {-(-size // args.chunk)} chunks -> {args.output}")
