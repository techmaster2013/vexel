#!/bin/sh
# Builds the Debian 12 + LXDE live ISO for Vexel's Linux VM. v86 emulates a 32-bit
# x86 PC, and Debian no longer publishes 32-bit desktop live images, so we build one
# with Debian's own live-build. Runs as root inside a privileged debian:bookworm
# container (see .github/workflows/debian-image.yml). Output: ./vexel-debian-lxde-i386.iso
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=$(pwd)
apt-get update
apt-get install -y --no-install-recommends live-build debootstrap syslinux syslinux-common isolinux squashfs-tools xorriso ca-certificates
work=$(mktemp -d)
cd "$work"
lb config \
  --mode debian \
  --distribution bookworm \
  --architectures i386 \
  --linux-flavours 686 \
  --archive-areas main \
  --apt-recommends false \
  --binary-images iso-hybrid \
  --bootloaders syslinux \
  --debian-installer none \
  --memtest none \
  --firmware-binary false \
  --firmware-chroot false \
  --chroot-squashfs-compression-type xz \
  --iso-volume "Vexel Debian LXDE" \
  --bootappend-live "boot=live components quiet net.ifnames=0 username=user hostname=vexel locales=en_US.UTF-8 keyboard-layouts=us"
cp -r "$here/config/." config/
lb build
cp live-image-i386.hybrid.iso "$out/vexel-debian-lxde-i386.iso"
ls -l "$out/vexel-debian-lxde-i386.iso"
