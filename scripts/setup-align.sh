#!/usr/bin/env bash
# Installs stable-ts (forced alignment for the Transcribe node) into a project-local venv.
# Needs `uv` (brew install uv) and a Python 3.13 (uv downloads one if missing). Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=.nodecine/tools/stable-ts
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required: brew install uv" >&2
  exit 1
fi
[ -x "$VENV/bin/python" ] || uv venv --python 3.13 "$VENV"
uv pip install --python "$VENV/bin/python" stable-ts
"$VENV/bin/python" -c "import stable_whisper; print('stable-ts', stable_whisper.__version__, 'ready at', '$VENV')"
echo "The whisper 'small' model (~460 MB) downloads on the first alignment."
