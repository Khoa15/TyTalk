#!/usr/bin/env bash
# Downloads tiny-voca (ONNX, English TTS) into models/tiny-voca and verifies the ONNX checksum.
set -euo pipefail
DEST="${1:-models/tiny-voca}"
BASE="https://huggingface.co/n4ze3m/tiny-voca/resolve/main"
ONNX_SHA256="fe6d918791a15b82e37465981d7f27a070e46b46635e5a3482fc8dff87a1ae46"

mkdir -p "$DEST/onnx" "$DEST/phonemizer"
curl -fL -o "$DEST/onnx/model.onnx" "$BASE/onnx/model.onnx"
echo "$ONNX_SHA256  $DEST/onnx/model.onnx" | shasum -a 256 -c -
for f in align.json g2p.json g2p.npz homographs.json lexicon.json lexicon.tsv sources.json LICENSE.cmudict LICENSE.homograph-data; do
  curl -fL -o "$DEST/phonemizer/$f" "$BASE/phonemizer/$f"
done
echo "tiny-voca ready in $DEST"
