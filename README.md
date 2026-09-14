# NodeCine

The open-source, node-based video studio. Build a workflow once from nodes, then every run turns new data into a video in the same style — locally.

## Status

The runtime is being made solid before the first genre is built on it. What ships today is the plumbing every film with a voice needs: voice-over, word timings, captions, a player, MP4 and subtitle export, and the HyperFrames and Remotion engines. There is no node yet that writes a script or draws a film, so a video cannot be made end to end in the app.

## Layout

- `core/` — how nodes run: the graph, the executor, pins, signatures and kept results, migrations, and the empty registries. It knows nothing about video.
- `contracts/` — what video nodes agree on: port types and their payloads, the video IR, the `html-gsap` scene machinery, the engine and provider interfaces. Registers into `core/` at startup.
- `capsules/` — everything that plugs in, one folder each and the same rules for all: `nodes/` (the steps of a workflow), `engines/` (HyperFrames, Remotion), `providers/` (models and voices). A capsule knows the Studio only through `sdk/`: the host a node body is handed and the kit it draws with. `migrations.ts` and `retired.json` carry old workflows across removed and renamed node types.
- `server/` — the runtime host: the job queue, result store, code fingerprints, workflow files; it knows no capsule. `server/contracts/` is the server half of `contracts/` and where the server is assembled: it registers the capsules, and holds the model, voice and render services, audio tools, the workflow tag in an MP4 and the film history.
- `app/`, `components/`, `store/`, `lib/` — the Studio.

`npm run capsules:check` enforces the walls between them; `npm run capsules:prepare` regenerates the registries and runs it.

## Licensing note

NodeCine is open source. It depends on [Remotion](https://remotion.dev), which is free for individuals and small teams but requires a company license for larger organizations. NodeCine does not redistribute Remotion; users are responsible for their own Remotion license.
