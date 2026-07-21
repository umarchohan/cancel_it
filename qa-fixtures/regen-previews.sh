#!/bin/sh
# Regenerate the browser preview pages from the real extension HTML.
# Run after any edit to extension/options.html or extension/popup.html.
cd "$(dirname "$0")/.." || exit 1

gen() {
  sed \
    -e 's|href="theme.css"|href="../../extension/theme.css"|' \
    -e "s|href=\"$2\"|href=\"../../extension/$2\"|" \
    -e 's|src="assets/|src="../../extension/assets/|g' \
    -e 's|src="firebase-config.js"|src="../chrome-stub.js"></script><script src="../../extension/firebase-config.js"|' \
    -e 's|src="analytics.js"|src="../../extension/analytics.js"|' \
    -e "s|src=\"$3\"|src=\"../../extension/$3\"|" \
    "extension/$1" > "qa-fixtures/ui-preview/${1%.html}-preview.html"
}

gen options.html options.css options.js
gen popup.html popup.css popup.js
echo "regenerated qa-fixtures/ui-preview/{options,popup}-preview.html"
