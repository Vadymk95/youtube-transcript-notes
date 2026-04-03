# Video notes prompt (for a downstream model)

**Usage (human):** Copy the block under the horizontal rule into a system or user message. Replace `{{TRANSCRIPT}}` with the full transcript (Markdown with timestamps is ideal).

**Model output language:** The assistant must answer **entirely in Russian** (all sections, headings, and bullets in Russian). Instructions below are in English so this file stays consistent with the rest of the repo documentation.

**Want another language?** Replace every **Russian** / **russian** in this file that refers to the reply language—especially this paragraph and the **Language requirement** line inside the prompt block below—then translate the **exact heading lines** in the required output block (e.g. `## О чем видео` → your target language) and update `src/summary/summaryContract.ts` plus the validator so automated checks still match. See also **Model output language** in the README.

---

You receive the **full video transcript** (segment timestamps optional; spoken language may be anything). You do **not** watch the video—work **only** from the text.

**Input — paste the transcript here:**

```
{{TRANSCRIPT}}
```

**Task:** Produce material for **another model** so it can skip reading dozens of pages and still get the gist and anchor facts.

**Language requirement:** Write your **complete** response in **Russian** only. Use the **exact Russian headings below** so the result can be validated automatically.

Required output format:

## О чем видео

Write 1–3 sentences about the topic, implied audience, and context if stated.

## Краткий план

Write a numbered list of **5–12** points in video order.

## Главные идеи

Write a bullet list of **3–7** takeaways.

## Важно для следующего агента

Use these exact subheadings:

### Факты, числа, имена

List facts, numbers, names, dates, books, authors, and links explicitly mentioned in the transcript. Do not invent.

### Термины и определения

List terms and definitions only if the video gives them.

### Практические шаги

List practical recommendations or actions if any.

### Риски и оговорки

List risks, caveats, or controversial points if the speaker raises them.

## Пробелы и неоднозначности

State what is cut off, contradictory, or needs checking against a primary source.

**Constraints:**

- Do not invent content absent from the transcript.
- Do not add historical context, speaker intent, audience assumptions, emotions, motives, or significance unless they are explicit in the transcript.
- Translation and summarization may rephrase the original wording, but they must not introduce new facts.
- If something is not explicitly stated, write `Не указано в транскрипте` or place the uncertainty in `## Пробелы и неоднозначности`.
- Avoid speculative phrases such as `вероятно`, `скорее всего`, `по-видимому`, `можно предположить`, or `похоже`, unless you are explicitly flagging ambiguity in `## Пробелы и неоднозначности`.
- Avoid long verbatim quotes; short accurate snippets are fine when they carry the core meaning.
- If the transcript is very short or incoherent, state the limits of what can be concluded.

---

**Optional pipeline:** Keep the raw transcript in a file; in the chat with the next model, attach the structured sections through **Важно для следующего агента** (or the equivalent headings in your target language) plus a path to the full transcript if needed.
