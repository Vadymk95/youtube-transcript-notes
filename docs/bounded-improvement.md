# Bounded improvement loop

This repository already encodes a **small surface area, verify, keep-or-revert** rhythm similar to the sibling project **agent-autoresearch** (sibling directory on disk, same parent folder as this repo). That framework stresses:

- one explicit task contract at a time
- bounded edits
- fast verification before claiming success
- temporary run artifacts vs permanent policy

## How it maps here

| agent-autoresearch idea  | youtube-transcript-notes equivalent                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `program.md` + profile   | `.cursor/rules/`, `prompts/video-notes-prompt.md`, `src/summary/outputLanguage.ts`                         |
| `runtime/TASK_SETUP.md`  | Cursor chat scope + URL + user goal                                                                        |
| Verify before handoff    | `npm run agent:check-summary -- "<summary-file>"`                                                          |
| Keep / revert            | Ralph loop: rewrite summary until validator passes; `rollbackAgentArtifactFiles` on failed `agent:prepare` |
| Fixture + metric harness | `npm run eval:transcript-quality` + `fixtures/transcript-quality/`                                         |
| Full gate                | `npm run ci`                                                                                               |
| Optional one-shot loop   | `npm run agent:complete` (prepare + `YT_SUMMARY_CMD` + validate, or `--prepare-only`)                      |

Use **scout-style** discovery only when you explicitly need repo-wide debt ranking; the default path is still one video URL and one artifact bundle.

For **using agent-autoresearch as the task harness while editing this repo** (contract in sibling `runtime/`, code here, verify with `npm run ci`), see [autoresearch-cross-repo-workflow.md](./autoresearch-cross-repo-workflow.md).

## Cyclic improvement in the industry

Common names (searchable, model-agnostic):

- **PDCA** (Plan–Do–Check–Act / Deming cycle): plan a small change, run it, measure against criteria, standardize or adjust ([Wikipedia: PDCA](https://en.wikipedia.org/wiki/PDCA)).
- **Kaizen**: continuous incremental improvement; PDCA is often the operational loop inside it.
- **OODA** (Observe–Orient–Decide–Act): shorter feedback cycles when the environment changes quickly — useful for agent tooling when upstream APIs or captions change.

For caption cleanup specifically, this repo’s **transcript quality harness** is the bounded “Check” step: change heuristics only when fixtures and metrics still pass.

## Practical cadence

1. **Plan**: one hypothesis (e.g. overlap threshold, new fixture).
2. **Do**: minimal code change.
3. **Check**: `npm run test` and, if touching collapse logic, `npm run eval:transcript-quality`.
4. **Act**: merge if green; otherwise revert and try a narrower hypothesis.

## Transcript size and “will it fit in the model?”

There is **no hardcoded maximum video duration** in this repo. Limits are practical:

- **Download / ASR**: `yt-dlp`, disk, and Whisper runtime scale with audio length.
- **Summary step**: `summary-prompt.md` embeds the **full** transcript (`assembleSummaryPrompt`). Effective limits come from the **LLM context window** and provider policies, not from this codebase.
- **Observability**: `manifest.json` includes `transcriptFileChars` and `transcriptBodyChars` (UTF-16 code units, same as JavaScript `String.length`) so an agent can estimate context use before loading the whole prompt.

Rough order of magnitude: English text is often budgeted at **~4 characters per token** for planning only — multiply `transcriptBodyChars` by 0.25 for a ballpark token estimate, then add template overhead and your model’s safety margin.
