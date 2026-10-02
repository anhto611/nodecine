# LLM Wiki Knowledge Base

A Markdown knowledge base for agents to ingest documents, synthesize knowledge, and answer questions with citations.
Workflow inspired by [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## Getting Started

1. Place source documents in `raw/`.
2. Instruct the agent: **Read knowledge/AGENTS.md, then ingest knowledge/raw/document-name.md into the wiki.**
3. Review the [index](wiki/index.md) and check newly created pages.

Example agent prompts:

- **Based on knowledge/wiki, answer … with citations.**
- **Save that analysis as a synthesis page and update the index.**
- **Lint knowledge/wiki: check broken links, sources, contradictions, and stale claims.**
- **Ingest URL … into knowledge, preserve provenance, and update related pages.**

No server, package installation, or dedicated API key is required for this directory.
The agent synthesizes knowledge on request; this is not a background process.

## Viewing in Obsidian

If you use Obsidian, use **Open folder as vault** and select the `knowledge` directory.
You can also view and edit files with any Markdown editor.

## Structure

- `raw/`: original source files, preserved as-is after ingestion.
- `wiki/`: compiled knowledge, catalog index, and update history.
- `templates/`: page templates for agent use.
- `AGENTS.md`: rules for ingestion, querying, and maintenance.

Files in this directory live in the current repository. Review contents before committing or sharing.
