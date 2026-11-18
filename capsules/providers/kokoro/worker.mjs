// Kokoro TTS worker for NodeCine, on sherpa-onnx (no Python). The model folder is argv[2]; it loads once, then reads
// one JSON per line from stdin and answers one per line, the same way the Python voice workers do.
// In : {"text": "...", "sid": 3, "speed": 1, "out": "path.wav"}
// Out: {"ok": true, "audio": "path.wav", "seconds": 2.41}
import path from 'node:path';
import readline from 'node:readline';
import sherpa from 'sherpa-onnx-node';

const dir = process.argv[2];
const f = (name) => path.join(dir, name);
let tts;
try {
  tts = new sherpa.OfflineTts({
    model: {
      kokoro: { model: f('model.int8.onnx'), voices: f('voices.bin'), tokens: f('tokens.txt'), dataDir: f('espeak-ng-data'), lexicon: `${f('lexicon-us-en.txt')},${f('lexicon-zh.txt')}` },
      numThreads: 2,
    },
    maxNumSentences: 1,
  });
} catch (e) {
  process.stderr.write(`could not load the Kokoro model from ${dir}: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ ready: true, sr: tts.sampleRate })}\n`);

for await (const line of readline.createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  let answer;
  try {
    const req = JSON.parse(line);
    const audio = tts.generate({ text: req.text, sid: req.sid, speed: req.speed ?? 1, enableExternalBuffer: false });
    sherpa.writeWave(req.out, { samples: audio.samples, sampleRate: audio.sampleRate });
    answer = { ok: true, audio: req.out, seconds: Math.round((audio.samples.length / audio.sampleRate) * 1000) / 1000 };
  } catch (e) {
    answer = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  process.stdout.write(`${JSON.stringify(answer)}\n`);
}
