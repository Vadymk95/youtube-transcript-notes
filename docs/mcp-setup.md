# YouTube transcript MCP (no custom server in this repo)

## Is there an official free MCP?

The **modelcontextprotocol/servers** monorepo does **not** ship a first-party reference server dedicated to YouTube transcripts. Community proposals (e.g. [PR #98](https://github.com/modelcontextprotocol/servers/pull/98)) were **not merged**; the maintainers keep that repo to a small set of reference servers and point new integrations to **separate packages/repositories**.

So there is **no** “single MD in the repo + official Anthropic button” story for YouTube: you need an **external** MCP package or a CLI like this one.

## Community MCP (Cursor-friendly)

A common choice is **`@kimtaeyoon83/mcp-server-youtube-transcript`** (npm; source: [kimtaeyoon83/mcp-server-youtube-transcript](https://github.com/kimtaeyoon83/mcp-server-youtube-transcript)). It typically exposes a tool to fetch a transcript by URL/ID without shipping code in your repo.

Example `mcp.json` snippet (confirm the exact `command` / `args` in the package README—they may change):

```json
{
    "mcpServers": {
        "youtube-transcript": {
            "command": "npx",
            "args": ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript"]
        }
    }
}
```

Before wiring it up, double-check the current install/run instructions (npx, bun, global install, etc.).

## Why this repository (CLI) still exists

This project targets a different workflow: **yt-dlp** (manual → auto subtitles), optional **local Whisper** via `YT_TRANSCRIPT_WHISPER_CMD`, and a single **timestamped Markdown** file. The MCP above usually does **not** mirror that full pipeline; for offline use and maximum control, use the CLI in this repo.
