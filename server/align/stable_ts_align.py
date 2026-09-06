"""
Forced alignment with stable-ts: the narration text comes in on stdin, the audio path and language
as arguments, and one JSON array of {text, start, end} (seconds) goes out on stdout.

Alignment, not transcription: the words are ours, the model only has to say when each one is
spoken, so a small model is enough and the text can never come back misspelled.
"""
import argparse
import json
import sys
from typing import Any


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--language", required=True)
    ap.add_argument("--model", default="small")
    args = ap.parse_args()
    text = sys.stdin.read().strip()
    if not text:
        print("no text on stdin", file=sys.stderr)
        return 2

    # Imported late so a missing install fails fast with a clear message. The module lives in the
    # project venv (npm run setup:align), which an editor's default interpreter cannot see.
    import stable_whisper  # type: ignore[import-not-found]

    # Whisper knows two-letter codes; "vi-VN" is "vi" to it.
    language = args.language.split("-")[0].lower()
    # stable-ts patches its methods onto whisper's model at runtime, so the static type is not useful.
    model: Any = stable_whisper.load_model(args.model)
    result: Any = model.align(args.audio, text, language=language, verbose=None)
    words = []
    for segment in result.segments:
        for w in segment.words:
            t = w.word.strip()
            if t:
                words.append({"text": t, "start": round(float(w.start), 3), "end": round(float(w.end), 3)})
    json.dump(words, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
