# Local VieNeu-TTS (Apache 2.0) TTS worker for the engine: reads one JSON per line from stdin, writes a WAV plus word timings.
# In : {"text": "...", "voice": "Hải Đăng", "out": "path.wav", "pause": 0.28}  (or "ref": "sample-voice.wav" = clone a voice from a 5-15 second sample)
# Out: {"ok": true, "audio": "path.wav", "words": [{"w": "word", "t": 0.12, "e": 0.40}, ...]}
# VieNeu returns no word timings -> synthesise ONE SENTENCE AT A TIME, trim leading/trailing silence, split the sentence duration by syllable count
# (numbers/units are normalised first so the count is right: "120" = 4 syllables), and a comma adds one pause beat.
import json, os, re, sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")


def pin_hf():
    # Load the exact model commits the app checked (NODECINE_HF_PINS = {"org/repo": "commit"}) instead of whatever the
    # shared hub's refs/main points at; must run before the voice library imports huggingface_hub's functions.
    pins = json.loads(os.environ.get("NODECINE_HF_PINS") or "{}")
    if not pins:
        return
    import huggingface_hub as hh
    from huggingface_hub import file_download as fd, _snapshot_download as sd

    def wrap(f):
        def pinned(repo_id, *a, **k):
            if k.get("revision") in (None, "main") and repo_id in pins:
                k["revision"] = pins[repo_id]
            return f(repo_id, *a, **k)
        return pinned
    for mod, name in ((hh, "hf_hub_download"), (fd, "hf_hub_download"), (hh, "snapshot_download"), (sd, "snapshot_download"),
                      (hh, "try_to_load_from_cache"), (fd, "try_to_load_from_cache")):
        if hasattr(mod, name):
            setattr(mod, name, wrap(getattr(mod, name)))


pin_hf()
from vieneu import Vieneu  # noqa: E402

tts = Vieneu()
SR = tts.sample_rate
norm = tts.normalizer.normalize

def sentences(text):
    parts = re.split(r"(?<=[.!?…])\s+", text.strip())
    return [p for p in parts if p.strip()]

def chunks(text, limit=200):
    # "whole": read the whole line in one breath (keeps the intonation joining "Ơ!", "Pi ơi..." to what follows); split only when too long
    out, cur = [], ""
    for s in sentences(text):
        if cur and len(cur) + 1 + len(s) > limit:
            out.append(cur); cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur: out.append(cur)
    return out

def trim(a, thr=0.012, pad=0.03):
    # cut silence by 10 ms frame energy
    f = int(SR * 0.01)
    n = len(a) // f
    if n == 0:
        return a, 0
    e = np.sqrt((a[: n * f].reshape(n, f) ** 2).mean(axis=1))
    on = np.where(e > thr * max(e.max(), 1e-6) * 4)[0]
    if len(on) == 0:
        return a, 0
    s = max(0, on[0] * f - int(pad * SR))
    t = min(len(a), (on[-1] + 1) * f + int(pad * SR))
    return a[s:t], s

def syl(word):
    clean = re.sub(r"[\"“”‘’()\[\]]", "", word)
    if not clean.strip(".,;:!?…—-"):
        return 0
    try:
        z = norm(clean)
    except Exception:
        z = clean
    return max(1, len([x for x in re.split(r"\s+", z.strip(" .,;:!?…")) if x]))

def handle(req):
    voice, pause, ref = req.get("voice") or None, float(req.get("pause", 0.28)), req.get("ref") or None
    kw = {"temperature": float(req["temperature"])} if req.get("temperature") is not None else {}  # intonation variation (VieNeu default 0.8)
    out, words, t0 = [], [], 0.0
    END = r"[.!?…]+[\"”)]*$"
    for sent in (chunks(req["text"]) if req.get("whole") else sentences(req["text"])):
        a = np.asarray(tts.infer(sent, ref_audio=ref, **kw) if ref else tts.infer(sent, voice=voice, **kw), dtype=np.float32)
        a, _ = trim(a)
        dur = len(a) / SR
        toks = sent.split()
        w8 = []
        for j, tok in enumerate(toks):
            k = syl(tok)
            # pause beat: about 0.9 syllable after a comma; about 1.6 syllables after a sentence end INSIDE a paragraph (one breath)
            k2 = 0.9 if re.search(r"[,;:—]$", tok) else (1.6 if j < len(toks) - 1 and re.search(END, tok) else 0)
            w8.append(k + k2)
        tot = sum(w8) or 1
        acc = 0.0
        for j, (tok, k) in enumerate(zip(toks, w8)):
            if k == 0:
                continue
            s = t0 + dur * acc / tot
            acc += k
            e = t0 + dur * acc / tot
            if re.search(r"[,;:—]$", tok):  # the pause beat after a comma does not count towards the word
                e -= dur * 0.9 / tot
            elif re.search(END, tok) and j < len(toks) - 1:
                e -= dur * 1.6 / tot
            words.append({"w": tok.strip("\"“”‘’()"), "t": round(s, 3), "e": round(e, 3)})
        out.append(a)
        out.append(np.zeros(int(pause * SR), dtype=np.float32))
        t0 += dur + pause
    audio = np.concatenate(out[:-1]) if out else np.zeros(1, dtype=np.float32)
    tts.save(audio, req["out"])
    return {"ok": True, "audio": req["out"], "words": words, "sr": SR}

print(json.dumps({"ready": True, "sr": SR}), flush=True)
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        res = handle(json.loads(line))
    except Exception as ex:  # report the error to node instead of killing the worker
        res = {"ok": False, "error": f"{type(ex).__name__}: {ex}"}
    print(json.dumps(res, ensure_ascii=False), flush=True)
