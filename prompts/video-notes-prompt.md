# Video notes prompt (for a downstream model)

**Usage (human):** Copy the block under the horizontal rule into a system or user message. Replace `{{TRANSCRIPT}}` with the full transcript (Markdown with timestamps is ideal).

**Model output language:** The assistant must answer **entirely in {{OUTPUT_LANGUAGE_NAME}}** (all sections, headings, and bullets in {{OUTPUT_LANGUAGE_NAME}}). Instructions below are in English so this file stays consistent with the rest of the repo documentation.

**Want another language?** Edit `src/summary/outputLanguage.ts`. The prompt, validator, reply language code, and summary filename all derive from that single config. See also **Model output language** in the README.

---

You receive the **full video transcript** (segment timestamps optional; spoken language may be anything). You do **not** watch the video—work **only** from the text.

**Input — paste the transcript here:**

```
{{TRANSCRIPT}}
```

**Task:** Produce material for **another model** so it can skip reading dozens of pages and still get the gist and anchor facts.

**Language requirement:** Write your **complete** response in **{{OUTPUT_LANGUAGE_NAME}}** only. Use the **exact headings below** so the result can be validated automatically.

Required output format:

{{REQUIRED_OUTPUT_FORMAT}}

**Constraints:**

- Do not invent content absent from the transcript.
- Do not add historical context, speaker intent, audience assumptions, emotions, motives, or significance unless they are explicit in the transcript.
- Translation and summarization may rephrase the original wording, but they must not introduce new facts.
- If something is not explicitly stated, write `{{AMBIGUITY_FALLBACK}}` or place the uncertainty in the ambiguity section.
- Avoid speculative phrases such as {{SPECULATIVE_MARKERS}}, unless you are explicitly flagging ambiguity in the ambiguity section.
- Avoid long verbatim quotes; short accurate snippets are fine when they carry the core meaning.
- If the transcript is very short or incoherent, state the limits of what can be concluded.

---

**Optional pipeline:** Keep the raw transcript in a file; in the chat with the next model, attach the structured sections through **{{HANDOFF_HEADING_TEXT}}** plus a path to the full transcript if needed.
