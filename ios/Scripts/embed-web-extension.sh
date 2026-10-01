#!/bin/sh
# Copies the built Safari web extension (pnpm build:safari) into the extension
# bundle, where Safari looks for manifest.json. An iOS extension bundle is flat,
# so files copied on an earlier build are removed by name rather than by
# clearing the folder, which also holds Info.plist and the executable.
set -eu

SOURCE="${SRCROOT}/../.output/safari-mv2"
DESTINATION="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
RECORD="${DERIVED_FILE_DIR}/embedded-web-extension-files.txt"

if [ ! -f "${SOURCE}/manifest.json" ]; then
  echo "error: ${SOURCE}/manifest.json not found. Run 'pnpm build:safari' in the repository root first." >&2
  exit 1
fi

mkdir -p "${DESTINATION}" "${DERIVED_FILE_DIR}"

if [ -f "${RECORD}" ]; then
  while IFS= read -r file; do
    rm -f "${DESTINATION}/${file}"
  done < "${RECORD}"
fi

(cd "${SOURCE}" && find . -type f ! -name '.DS_Store' | sed 's|^\./||') > "${RECORD}"
rsync -a --exclude '.DS_Store' "${SOURCE}/" "${DESTINATION}/"
