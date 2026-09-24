#!/bin/sh
# Regenerates the vendored on-device image-detection assets from pinned npm releases:
#   extension/vendor/tf.es2017.min.js          TensorFlow.js 4.22.0 (Apache-2.0), ES2017 build
#   extension/models/nsfw/model.json + .bin    NSFWJS 4.4.0 "MobileNetV2" weights (MIT)
#   extension/vendor/THIRD_PARTY_LICENSES.txt  license texts for the above
#
# WHY the ES2017 build: the default tf.min.js calls Function("return this") at load time, which
# Manifest V3's extension-page CSP forbids (no 'unsafe-eval'). tf.es2017.min.js loads cleanly.
# Nothing is installed into the repo — npm runs in a throwaway temp dir.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm init -y >/dev/null 2>&1
npm install --ignore-scripts --no-audit --no-fund nsfwjs@4.4.0 @tensorflow/tfjs@4.22.0 >/dev/null 2>&1

mkdir -p "$ROOT/extension/vendor" "$ROOT/extension/models/nsfw"
cp node_modules/@tensorflow/tfjs/dist/tf.es2017.min.js "$ROOT/extension/vendor/tf.es2017.min.js"

# The npm package ships the weights base64-wrapped in JS; decode to raw model.json + .bin.
ROOT="$ROOT" node - <<'JS'
const fs = require('fs');
const dir = 'node_modules/nsfwjs/dist/models/mobilenet_v2/';
const model = require('./' + dir + 'model.min.js');
const out = process.env.ROOT + '/extension/models/nsfw/';
const paths = {};
for (const group of model.weightsManifest) for (const p of group.paths) {
  fs.writeFileSync(out + p + '.bin', Buffer.from(require('./' + dir + p + '.min.js'), 'base64'));
  paths[p] = p + '.bin';
}
model.weightsManifest.forEach((g) => { g.paths = g.paths.map((p) => paths[p]); });
fs.writeFileSync(out + 'model.json', JSON.stringify({
  format: 'layers-model', generatedBy: 'nsfwjs 4.4.0', convertedBy: 'TensorFlow.js Converter',
  modelTopology: model.modelTopology, weightsManifest: model.weightsManifest
}));
JS

{
  echo "Third-party software bundled with Cancel It's on-device image detection"
  echo "======================================================================"
  echo
  echo "TensorFlow.js 4.22.0 — Apache License 2.0 (extension/vendor/tf.es2017.min.js)"
  echo "Copyright 2024 Google LLC. The file carries its own copyright header; the npm package ships no"
  echo "separate LICENSE file, so the standard, unmodified Apache-2.0 text is reproduced below."
  echo "----------------------------------------------------------------------"
  cat node_modules/long/LICENSE
  echo
  echo "NSFWJS 4.4.0 — MIT License (model weights in extension/models/nsfw/)"
  echo "The weights are the MobileNetV2 model from github.com/GantMan/nsfw_model, distributed via NSFWJS."
  echo "----------------------------------------------------------------------"
  cat node_modules/nsfwjs/LICENSE
} > "$ROOT/extension/vendor/THIRD_PARTY_LICENSES.txt"
echo "vendored: $(du -sh "$ROOT/extension/vendor" | cut -f1) vendor, $(du -sh "$ROOT/extension/models/nsfw" | cut -f1) model"
