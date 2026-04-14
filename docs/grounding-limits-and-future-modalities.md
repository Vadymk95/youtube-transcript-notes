# Grounding, structured answers, and limits (transcript vs on-screen UI)

This document ties together three product concerns:

1. **Accuracy** — answers must follow what was **said** in the video (and documented context rules), not the title alone.
2. **Structure** — final markdown must match the **published contract** (headings, sections) so `agent:check-summary` and downstream agents stay reliable.
3. **Modalities** — speech transcripts **do not** capture slides, browser UI, terminal output, or on-screen diagrams unless that content is **spoken**. Models can **hallucinate or overfill gaps** when the important signal is visual.

## 1. Making answers more accurate

| Layer                           | What it does                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transcript pipeline**         | Produces `transcript.md` from subtitles or Whisper; avoids “guessing from URL/title” when the workflow runs.                                                                                                  |
| **`manifest.json`**             | Gives `transcriptBodyChars`, `replyLanguage`, `videoDescription`, and **alignment** fields so agents budget context and know when page text may be misaligned with speech (see `.cursor/brain/DECISIONS.md`). |
| **`summary-prompt.md` + model** | The chat step drafts `summary.<replyLanguage>.md`; quality depends on the model **following** transcript-first rules in `prompts/video-notes-prompt.md`.                                                      |
| **`agent:check-summary`**       | Machine validation of headings/shape; **not** semantic fact-checking against the world.                                                                                                                       |

**Practical rule:** treat the validator as **shape and completeness**, not **truth**. Wrong-but-well-formed summaries still require human or second-pass review against `transcript.md`.

## 2. Making answers more structured

Structure is **encoded**, not implied:

- Template: `prompts/video-notes-prompt.md`
- Language presets and required headings: `src/summary/outputLanguage.ts`
- Validator rules: `src/summary/summaryContract.ts`

**Roadmap (see [technical-debt-roadmap.md](./technical-debt-roadmap.md) item 2):** optional **denser handoff** for a **second-hop LLM** (stronger BLUF, extractable facts such as versions and dates in fixed subsections). That is a **contract change**: prompt + presets + validator + tests must move together.

## 3. Where models err without UI / screenshots

**Observed failure mode:** the video shows code, a config screen, or a slide with version numbers; the speaker says “as you can see here” without reading every line. A **text-only transcript** may omit the exact strings on screen, so a summarizer can **invent** plausible values or miss critical UI steps.

**What this repo provides today**

- **Spoken content** in `transcript.md`
- **YouTube description** in `manifest.json` (and sometimes YAML in `transcript.md` when alignment is not `low`) — links and pasted text, **not** a substitute for unspoken on-screen pixels
- **Gaps / ambiguity** sections in the summary contract (language presets) — use them when the transcript does not contain the fact

**What the pipeline can add (optional)**

- **`verification-hints.md`** — URLs from the page description + sample transcript timestamps for manual or downstream checks (**no network** in this step).
- **`keyframes/*.jpg`** — still images at sampled cue times via **yt-dlp** (merged video) + **ffmpeg** when **`--key-frames`** or **`YT_TRANSCRIPT_KEY_FRAMES=1`** (heavy download).

**Still not in core**

- Automatic OCR or a bundled **vision** model to read slides (you can attach images to chat manually or wire an external vision step).
- A browser extension or full UI (roadmap item **6**).

The canonical path remains URL → transcript → summary → `agent:check-summary`; key frames and hints are **optional context**, not a substitute for transcript grounding.

## 4. Audit checklist: “screens / UI” in a text-only workflow

Use this when reviewing a summary (with or without optional **`keyframes/`** stills):

1. **Flag claims** that look like exact version numbers, file paths, or UI labels — **verify** against `transcript.md` (spoken) or quoted text in description, not memory.
2. If **`videoDescriptionAlignment`** is **`low`** and policy is heuristic, treat embedded YAML description as **unreliable** for speech content (see `DECISIONS.md`).
3. If the video is **demo-heavy**, state in the summary **gaps** that on-screen detail was not transcribed unless explicitly read aloud.
4. With **`--key-frames`**, review **`keyframes/`** for on-screen text; the model still must not invent unreadable pixels.
5. For **highest precision** beyond stills, manually attach extra screenshots in **chat** if needed.

## 5. Related commands

```bash
npm run agent:prepare -- "<youtube-url>"
npm run agent:check-summary -- "artifacts/videos/<videoId>/summary.<replyLanguage>.md" [--reply-lang <code>]
```

---

**Summary:** tighten **accuracy** with transcript-first rules and careful use of description; tighten **structure** via the existing contract and future roadmap item 2; treat **UI/screenshot gaps** as a known modality limit until multimodal or UI work ships.
