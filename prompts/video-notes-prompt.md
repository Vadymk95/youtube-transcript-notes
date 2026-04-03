# Video notes prompt (for a downstream model)

**Usage (human):** Copy the block under the horizontal rule into a system or user message. Replace `{{TRANSCRIPT}}` with the full transcript (Markdown with timestamps is ideal).

**Model output language:** The assistant must answer **entirely in Russian** (all sections, headings, and bullets in Russian). Instructions below are in English so this file stays consistent with the rest of the repo documentation.

**Want another language?** Replace every **Russian** / **russian** in this file that refers to the reply language—especially this paragraph and the **Language requirement** line inside the prompt block below—then align “Russian section titles” with your target (e.g. “German section titles”). See also **Model output language** in the README.

---

You receive the **full video transcript** (segment timestamps optional; spoken language may be anything). You do **not** watch the video—work **only** from the text.

**Input — paste the transcript here:**

```
{{TRANSCRIPT}}
```

**Task:** Produce material for **another model** so it can skip reading dozens of pages and still get the gist and anchor facts.

**Language requirement:** Write your **complete** response in **Russian** only. Use clear Russian section titles matching the structure below.

Structure:

1. **What the video is about (1–3 sentences)** — topic, implied audience, context if the speaker states it.
2. **Short outline / narrative flow** — numbered list of **5–12** points in video order (how the argument is built, where it leads).
3. **Main ideas and theses** — bullet list of **3–7** takeaways.
4. **Important for handoff** — separate block for the next model:
    - **Facts, numbers, names, dates, links/books/authors** explicitly mentioned in the transcript (list them; do not invent).
    - **Terms and definitions** if the video gives them.
    - **Practical steps or recommendations** if any (concise).
    - **Risks, caveats, controversial points** if the speaker raises them.
5. **Gaps and ambiguities** — what is cut off, contradictory, or needs checking against a primary source (if something is not in the text, say so—no hallucinations).

**Constraints:**

- Do not invent content absent from the transcript.
- Avoid long verbatim quotes; short accurate snippets are fine when they carry the core meaning.
- If the transcript is very short or incoherent, state the limits of what can be concluded.

---

**Optional pipeline:** Keep the raw transcript in a file; in the chat with the next model, attach **sections 1–4** only plus a path or filename to the full transcript if needed.
