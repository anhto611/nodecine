# NodeCine

The open-source, node-based video studio. Build a workflow once from nodes, then every run turns new data into a video in the same style — locally.

## Status

The runtime is being made solid before the first genre is built on it. A workflow runs on one engine, used the way that engine is used: today HyperFrames, whose composition is an HTML project declaring its variables. What ships is the plumbing around it: a Composition node that holds the project, voice-over and word timings, a Fill node that pours them and values for the variables into the composition, a player, MP4 and subtitle export. There is no node yet that writes a script, and no composition for a genre yet.

## Layout

- `core/` — how nodes run: the graph, the executor, pins, signatures and kept results, migrations, and the empty registries. It knows nothing about video.
- `contracts/` — what video nodes agree on: port types and their payloads, the composition an engine previews and renders, the engine and provider interfaces. Registers into `core/` at startup.
- `capsules/` — everything that plugs in, one folder each and the same rules for all: `nodes/` (the steps of a workflow), `engines/` (HyperFrames), `providers/` (models and voices). A capsule knows the Studio only through `sdk/`: the host a node body is handed and the kit it draws with. `migrations.ts` and `retired.json` carry old workflows across removed and renamed node types.
- `server/` — the runtime host: the job queue, result store, code fingerprints, workflow files; it knows no capsule. `server/contracts/` is the server half of `contracts/` and where the server is assembled: it registers the capsules, and holds the model, voice and render services, audio tools, the workflow tag in an MP4 and the run history.
- `app/`, `components/`, `store/`, `lib/` — the Studio.

`npm run capsules:check` enforces the walls between them; `npm run capsules:prepare` regenerates the registries and runs it.

