#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required."
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
npm run build
echo "Service: http://127.0.0.1:3000/"
echo "Logs: $(pwd)/logs"
npm run server
