# Cross-repo bounded tasks with agent-autoresearch

This describes how to use the sibling **agent-autoresearch** repo as a **task harness** while changing **this** repository (`youtube-transcript-notes`). It matches the workflow you want (problem file + desired behavior + verification), with one critical clarification:

**agent-autoresearch scripts do not generate or repair code.** They create `runtime/TASK_SETUP.md`, optional `runtime/CANDIDATE_LIST.md`, and logging hooks. The **fix is always implemented by an agent or human** who follows that contract and edits the **target** repo. Verification is whatever you write into the contract (here: `npm run ci` in this project).

## Why not “copy the file into autoresearch”?

You _can_ paste snippets into `TASK_SETUP.md` or attach paths, but the **canonical source of truth** should stay in `youtube-transcript-notes`. Editing a duplicate in another tree risks drift. Preferred pattern:

- **Contract and ledger** live under `agent-autoresearch/runtime/`.
- **Code changes** live only under `youtube-transcript-notes/`.
- **Verification** runs in `youtube-transcript-notes` after each iteration.

## Recommended pipeline

### 1. Optional: scout this repo for ranked candidates

From `agent-autoresearch`:

```bash
python3 scripts/scout_repo.py --target-repo ../youtube-transcript-notes --strategy scored --write-runtime
```

If the candidate list is dominated by **`node_modules`**, configure the scout to ignore dependency trees (see **agent-autoresearch** README or flags) or run from a clean target checkout—otherwise ranked items are noise.

Read `agent-autoresearch/runtime/CANDIDATE_LIST.md`. To turn the top item into a formal task:

```bash
python3 scripts/promote_candidate.py --target-repo ../youtube-transcript-notes --strategy scored --index 1 --force
```

(Adjust `--index` and read that repo’s README if flags differ slightly.)

### 2. Create a task setup

```bash
python3 scripts/init_task.py --profile coding --goal "Describe concrete fix for <file> in youtube-transcript-notes"
```

If `runtime/TASK_SETUP.md` already exists, use `--force` only after you have archived or finished the previous run.

### 3. Fill the contract (this is the important part)

Edit `agent-autoresearch/runtime/TASK_SETUP.md` and make **explicit**:

- **Goal / outcome**: what “works perfectly” means (inputs, outputs, edge cases).
- **Allowed edit surface**: e.g. `youtube-transcript-notes/src/transcript/foo.ts` and matching tests only.
- **Forbidden**: unrelated refactors, rule churn, generated `artifacts/`.
- **Verification harness — required checks**: e.g. `cd ../youtube-transcript-notes && npm run ci`.
- **Cheapest first verification**: `npm run test -- --run path/to.test.ts` before full `ci` if applicable.

### 4. Execute in the target repo (Cursor / agent / you)

Open `youtube-transcript-notes`, apply minimal changes, remove obsolete code only when the new behavior subsumes it.

### 5. Verify and close

- Run the checks listed in `TASK_SETUP.md`.
- Optionally: `python3 scripts/log_result.py` with pass/fail notes (see autoresearch README).
- After acceptance: `python3 scripts/cleanup_task.py` so `runtime/` does not become permanent policy.

## What “running the pipeline” means in practice

| Step                          | Tool / artifact                    | Produces code?      |
| ----------------------------- | ---------------------------------- | ------------------- |
| Scout                         | `scout_repo.py`                    | No — ranked ideas   |
| Promote                       | `promote_candidate.py`             | No — seeds TASK     |
| Init                          | `init_task.py`                     | No — empty contract |
| Contract fill                 | Human / agent edits                | No                  |
| Implementation + verification | Target repo + `npm run ci`         | **Yes**             |
| Log / cleanup                 | `log_result.py`, `cleanup_task.py` | No                  |

## Alignment with this repo’s quality gates

- General changes: **`npm run ci`**.
- Caption collapse / overlap heuristics: also **`npm run eval:transcript-quality`**.
- Summary contract / headings: tests + **`npm run agent:check-summary`** when touching summaries.

## Summary

**Yes, you can work this way**: use autoresearch as the **discipline and paperwork layer**, and **youtube-transcript-notes** as the **only codebase that receives merges**. There is no separate “magic script” that returns a fixed file; the scripts **bound and document** the loop so the agent does not wander.
