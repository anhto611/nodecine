# OmniVoice (k2-fsa, Apache 2.0) TTS worker for NodeCine: reads one JSON per line from stdin, writes a WAV plus per-word timings.
# In : {"text": "...", "ref": "/w/channels/<channel>/voice/sample.wav", "refText": "words of the sample file", "out": "/w/.../raw.wav", "lang": "vi", "speed": 1.0}
# Out: {"ok": true, "audio": "...", "words": [{"w": "word", "t": 0.12, "e": 0.40}, ...]}
# OmniVoice clones a voice from a 3-10 second sample (ref) and reads the WHOLE line in one breath (keeps the intonation joining "Ơ!", "Khoan..." to what follows).
# Returns no word timings -> trim leading/trailing silence, split the duration by syllable count (a comma or a sentence end inside a paragraph adds a pause beat).
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
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from omnivoice import OmniVoice  # noqa: E402

SR = 24000
# NVIDIA GPU (CUDA) -> Mac M-series GPU (MPS) -> CPU. MPS uses float32 to be safe (some float16 ops are not fully supported).
if torch.cuda.is_available():
    DEVICE, DTYPE = "cuda:0", torch.float16
elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
    DEVICE, DTYPE = "mps", torch.float32
else:
    DEVICE, DTYPE = "cpu", torch.float32
print(f"OmniVoice running on {DEVICE}", file=sys.stderr, flush=True)
model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=DEVICE, dtype=DTYPE)
prompts = {}  # (ref, refText, mtime) -> VoiceClonePrompt (the sample voice is encoded once)

END = r"[.!?…]+[\"”)]*$"

def chunks(text, limit=200):
    out, cur = [], ""
    for s in [p for p in re.split(r"(?<=[.!?…])\s+", text.strip()) if p.strip()]:
        if cur and len(cur) + 1 + len(s) > limit:
            out.append(cur); cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur: out.append(cur)
    return out

def trim(a, thr=0.012, pad=0.03):
    f = int(SR * 0.01); n = len(a) // f
    if n == 0: return a
    e = np.sqrt((a[: n * f].reshape(n, f) ** 2).mean(axis=1))
    on = np.where(e > thr * max(e.max(), 1e-6) * 4)[0]
    if len(on) == 0: return a
    return a[max(0, on[0] * f - int(pad * SR)): min(len(a), (on[-1] + 1) * f + int(pad * SR))]

def syl(word):
    clean = re.sub(r"[\"“”‘’()\[\]]", "", word).strip(".,;:!?…—-")
    if not clean: return 0
    m = re.fullmatch(r"[\d.,]+", clean)
    if m:  # numbers: about 1.5 syllables per digit ("120" is about 4-5 syllables)
        return max(1, round(len(re.sub(r"\D", "", clean)) * 1.5))
    return max(1, len([x for x in re.split(r"[\s\-]+", clean) if x]))

def prompt(ref, ref_text):
    k = (ref, ref_text or "", os.path.getmtime(ref))
    if k not in prompts:
        prompts[k] = model.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text or None)
    return prompts[k]

def handle(req):
    ref = req.get("ref")
    if not ref: raise ValueError("OmniVoice needs voice.ref (a 3-10 second voice sample)")
    vp = prompt(ref, req.get("refText"))
    pause = float(req.get("pause", 0.28)); lang = req.get("lang") or None; speed = req.get("speed")
    out, words, t0 = [], [], 0.0
    for sent in chunks(req["text"]):
        kw = {"voice_clone_prompt": vp, "language": lang}
        if speed: kw["speed"] = float(speed)
        a = np.asarray(model.generate(text=sent, **kw)[0], dtype=np.float32).reshape(-1)
        a = trim(a); dur = len(a) / SR
        toks = sent.split(); w8 = []
        for j, tok in enumerate(toks):
            k = syl(tok)
            k2 = 0.9 if re.search(r"[,;:—]$", tok) else (1.6 if j < len(toks) - 1 and re.search(END, tok) else 0)
            w8.append(k + k2 if k else 0)
        tot = sum(w8) or 1; acc = 0.0
        for j, (tok, k) in enumerate(zip(toks, w8)):
            if k == 0: continue
            s = t0 + dur * acc / tot; acc += k; e = t0 + dur * acc / tot
            if re.search(r"[,;:—]$", tok): e -= dur * 0.9 / tot
            elif re.search(END, tok) and j < len(toks) - 1: e -= dur * 1.6 / tot
            words.append({"w": tok.strip("\"“”‘’()"), "t": round(s, 3), "e": round(e, 3)})
        out += [a, np.zeros(int(pause * SR), dtype=np.float32)]
        t0 += dur + pause
    audio = np.concatenate(out[:-1]) if out else np.zeros(1, dtype=np.float32)
    sf.write(req["out"], audio, SR)
    return {"ok": True, "audio": req["out"], "words": words, "sr": SR}

print(json.dumps({"ready": True, "sr": SR}), flush=True)
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        res = handle(json.loads(line))
    except Exception as ex:
        res = {"ok": False, "error": f"{type(ex).__name__}: {ex}"}
    print(json.dumps(res, ensure_ascii=False), flush=True)
