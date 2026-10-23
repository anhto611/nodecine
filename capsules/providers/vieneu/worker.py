"""
The VieNeu voice, kept loaded. NodeCine starts this once and talks to it a line of JSON at a time:
the model takes seconds to load, a sentence takes about a third of its own length to say, so it is
loaded once and asked many times. The text arrives on stdin, never on the command line.

Requests:  {"id": 1, "cmd": "voices"}
           {"id": 2, "cmd": "say", "text": "...", "voice": "Hải Đăng", "out": "C:/.../x.wav"}
           {"id": 3, "cmd": "say", "text": "...", "ref": "C:/.../my-voice.wav", "out": "..."}
Answers:   {"ready": true, "sampleRate": 48000} once, then {"id": n, ...} or {"id": n, "error": "..."}
"""
import json
import sys

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
# The answers keep stdout to themselves: whatever the library prints goes to stderr.
channel = sys.stdout
sys.stdout = sys.stderr


def send(message):
    channel.write(json.dumps(message, ensure_ascii=False) + "\n")
    channel.flush()


try:
    from vieneu import Vieneu

    tts = Vieneu()
except Exception as error:  # noqa: BLE001 - whatever stops it loading is what the person needs to read
    send({"ready": False, "error": f"{type(error).__name__}: {error}"})
    sys.exit(1)

send({"ready": True, "sampleRate": getattr(tts, "sample_rate", 48000)})

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        request = json.loads(line)
    except ValueError:
        continue
    rid = request.get("id")
    try:
        if request.get("cmd") == "voices":
            send({"id": rid, "voices": [[str(label), str(voice)] for label, voice in tts.list_preset_voices()]})
        elif request.get("cmd") == "say":
            if request.get("ref"):
                audio = tts.infer(request["text"], ref_audio=request["ref"])
            else:
                audio = tts.infer(request["text"], voice=request["voice"])
            tts.save(audio, request["out"])
            send({"id": rid, "ok": True})
        else:
            send({"id": rid, "error": f"unknown command {request.get('cmd')!r}"})
    except Exception as error:  # noqa: BLE001
        send({"id": rid, "error": f"{type(error).__name__}: {error}"})
