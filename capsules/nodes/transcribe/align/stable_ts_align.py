"""
Word timings with stable-ts: the audio path and language come in as arguments, the narration text on
stdin, and one JSON array of {text, start, end} (seconds) goes out on stdout.

Two modes, decided by whether there is text on stdin. With text it **aligns**: the words are ours and
the model only says when each is spoken, so a small model is enough and nothing can come back
misspelled. With no text it **transcribes**: nobody knows what was said — a recording somebody made
outside this app — so the model has to hear the words as well as time them.
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

    # Imported late so a missing install fails fast with a clear message. The module lives in the
    # project venv (npm run setup:align), which an editor's default interpreter cannot see.
    import stable_whisper  # type: ignore[import-not-found]

    # Whisper knows two-letter codes; "vi-VN" is "vi" to it.
    language = args.language.split("-")[0].lower()
    # stable-ts patches its methods onto whisper's model at runtime, so the static type is not useful.
    model: Any = stable_whisper.load_model(args.model)
    result: Any = (
        model.align(args.audio, text, language=language, verbose=None)
        if text
        else model.transcribe(args.audio, language=language, verbose=None, word_timestamps=True)
    )
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
