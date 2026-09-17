#!/usr/bin/env bash
# Downloads the matting model (cutting the speaker out, for the Matte node) into .nodecine/models.
# Robust Video Matting, MIT licensed, ~103 MB. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/../../.."
DIR=.nodecine/models
MODEL="$DIR/rvm_resnet50_fp32.onnx"
URL=https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50_fp32.onnx
if [ -f "$MODEL" ]; then
  echo "matting model already at $MODEL"
  exit 0
fi
mkdir -p "$DIR"
echo "downloading the matting model (~103 MB)…"
curl -fL --progress-bar -o "$MODEL.part" "$URL"
mv "$MODEL.part" "$MODEL"
echo "matting model ready at $MODEL"
