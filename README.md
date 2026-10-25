# Agent Eval Lab

**When you change your agent's model, add a skill, or give it tools, did it get better, worse, or stay the same?**

Agent Eval Lab runs a suite of tasks against several [Hermes Agent](https://github.com/NousResearch/hermes-agent) configurations, scores every run against known answers, and tells you which configuration is better **and how confident you can be**. You can watch runs live and open any single run to see exactly what the agent did and why it passed or failed.

Built with NestJS, Vue 3 and TypeScript, and run locally with one command.

> **Want a guided tour?** Read [`demo-explain.md`](demo-explain.md): a complete walkthrough of a sample run.

---

## Quick start

Prerequisites: **Node 22+**, **pnpm**, **Python 3.11+**. An **OpenAI API key** is needed for real runs only.

```bash
cp .env.example .env        # put your key in OPENAI_API_KEY (optional for the demo)
pnpm start                  # first run installs Hermes into .venv, then serves http://localhost:3000
```

**No key?** After `pnpm start` has run once (it installs dependencies), run `pnpm demo`, or choose **Simulated** as the agent under **New run**. This runs the full pipeline with a scripted stand-in agent: no model calls, $0, and labelled **SIMULATED** everywhere.

---

## The sample: Indian criminal law (BNS 2023)

The **Bharatiya Nyaya Sanhita, 2023 (BNS)** replaced the Indian Penal Code (IPC) on 1 July 2024. That makes it a good test: the answers are exact facts, and models trained mostly on older text tend to answer with repealed IPC numbers.

`suites/indian-criminal-law/` has **24 questions**, each with an exact answer checked against the official Gazette text. That text ships as `fixtures/statute/bns-2023.txt`.

| Kind | # | Example | Answer |
|---|---|---|---|
| `sec-*` which section | 9 | Which BNS section defines organised crime? | `{"section": 111}` |
| `pun-*` punishment | 7 | Maximum imprisonment for theft (first conviction)? | `{"maxYears": 3}` |
| `map-*` IPC → BNS | 6 | IPC 302 was replaced by which BNS section? | `{"section": 103}` |
| `now-*` law in force today | 2 | Murder on 15 Aug 2025: which code and section? | `{"code": "BNS", "section": 103}` |

**Three configs**, each changing one thing:

| Config | Model | Tools (`toolsets`) | Skills | What it tests |
|---|---|---|---|---|
| `baseline` | gpt-4.1-mini | `skills` | none | closed book: what the model remembers |
| `open-book` | gpt-4.1-mini | `skills, file, terminal` | none | retrieval: can it search the Act? |
| `mapping-skill` | gpt-4.1-mini | `skills` | `ipc-bns-mapping` | does a skill fix the IPC → BNS transition? |

---

## How it works: a 6-step pipeline

Each step does one job and writes its result to `data/experiments/<id>/`, so every intermediate result is a file you can open.

```
1 Load ─► 2 Plan ─► [ 3 Prepare ─► 4 Execute ─► 5 Score ]  per run ─► 6 Compare
```

| Step | What it does | Code (`apps/api/src/pipeline/steps/`) | Output |
|---|---|---|---|
| 1 · Load | Read and validate the YAML, then freeze a copy | `1-load.ts` | `1-definitions.json` |
| 2 · Plan | tasks × configs × N trials, plus a cost estimate | `2-plan.ts` | `2-plan.json` |
| 3 · Prepare | Give each run a private `HERMES_HOME` and a fresh workspace | `3-prepare.ts` | `runs/<id>/home/`, `workspace/` |
| 4 · Execute | `hermes -z "<prompt>"`, streaming each step live, then `hermes sessions export` | `4-execute.ts` | `trajectory.jsonl`, `result.json` |
| 5 · Score | Exact checks against the expected answer, plus efficiency and process diagnostics | `5-score.ts` | `score.json` |
| 6 · Compare | Paired bootstrap: better / worse / inconclusive with a 95% CI | `6-compare.ts` | `6-report.json` |

**How "better" is decided:** both configs are compared on the same tasks. A bootstrap re-picks tasks and trials 10,000 times to get a 95% confidence interval for the difference. **better** or **worse** means the whole interval is on one side of zero; otherwise the result is **inconclusive**. Cost and time are compared separately and never blended into the score.

**How answers are checked:** the expected answer lives next to the question (`expect: { section: 103 }`). After each run, code pulls the JSON out of the agent's reply and compares it field by field. There's no manual checking and no AI judge, and every mismatch is explained, e.g. `$.section: expected 103, got 302`.

---

## Features

| Feature | Where |
|---|---|
| **Verdicts with confidence intervals** (forest plot + results table) | Experiment page |
| **Task diff** vs the baseline (▲ improved, ▼ regressed, = unchanged), most-regressed first | Experiment page |
| **Reliability**: pass^k (every trial passed), flaky tasks, "≈N trials would settle it" | Results table |
| **Live streaming**: each agent step appears as Hermes writes it | Live activity, run inspector |
| **Run inspector**: trajectory, check-by-check explanations, workspace files | Click any run chip |
| **Side-by-side compare**: baseline vs candidate on the same task | Task diff → click a task |
| **Retry broken runs**: re-run only timeouts and API errors | Experiment header |
| **CI gate**: `pnpm eval:ci` exits 1 on a *worse* verdict; **CSV/JSON export** | CLI, experiment header |
| **Light/dark mode, responsive layout, WCAG 2.2 AA** | Everywhere |

---

## Adding tasks and configs

**A task** (in `suites/<suite>/suite.yaml`). Tasks are grouped in the UI by id prefix; name the groups at the top of the suite with `groups: { pun: What is the punishment? }`.

```yaml
- id: pun-snatching                      # illustrative; BNS 304(2): up to 3 years
  prompt: >-
    Under the Bharatiya Nyaya Sanhita, 2023, what is the maximum imprisonment, in years, for snatching?
    If you can read files, the full Act is in bns-2023.txt in your working directory.
    Reply with ONLY a JSON object: {"maxYears": number}
  fixtures: fixtures/statute             # files copied into the agent's workspace
  checks:
    - id: max-years
      type: answer_json                  # answer_contains | answer_json | file_json
      expect: { maxYears: 3 }
  processChecks: [tool_errors, hit_turn_limit]
```

**A config** (in `configs/<id>.yaml`):

```yaml
id: open-book
model: gpt-4.1-mini                      # → hermes -m
toolsets: [skills, file, terminal]       # → hermes -t   (Hermes's built-in tools)
skills: []                               # → skills/<name>/SKILL.md installed for the run
maxTurns: 12                             # → agent.max_turns
price: { inputPerMTok: 0.40, outputPerMTok: 1.60 }   # cost estimate only
# memory: path/to/seed.md                # optional: seeds the agent's memory
```

Invalid files are listed in the UI with the exact problem, and can't be launched.

---

## Project layout

```
apps/api            NestJS (Fastify), MVC: controllers/ services/ models/ views/ + pipeline/steps/
apps/web            Vue 3 + Vite + Tailwind, one folder per feature
packages/shared     zod schemas + types shared by API and UI
suites/ configs/ skills/   the definitions (YAML + markdown)
scripts/start.mjs   what `pnpm start` does
data/               (gitignored) experiment outputs
```

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/README.md`](docs/README.md) | Start here: setup, UI tour, glossary, adding tasks and configs |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Architecture: components, pipeline, data flow, scoring and statistics |
| [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) | Current scope and future directions |
| [`docs/COSTS.md`](docs/COSTS.md) | Approximate cost of a pipeline run |
| [`docs/GUIDE.md`](docs/GUIDE.md) | How it works, function by function |
| [`demo-explain.md`](demo-explain.md) | Walkthrough of a sample run |
| [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) | Numbered assumptions |

## Commands

```bash
pnpm start          # bootstrap + build + serve http://localhost:3000
pnpm demo           # sample suite × 3 configs × 3 trials with the SIMULATED agent ($0)
pnpm eval:ci --suite indian-criminal-law --configs baseline,open-book --trials 3   # real run / CI gate
pnpm test           # API + web tests (no key needed)
pnpm typecheck
pnpm format
pnpm dev:api        # API on :3000
pnpm dev:web        # UI with hot reload on :5173
```

## Troubleshooting

- **"API call failed … Connection error"** in a run means Hermes (Python) can't reach api.openai.com. Behind a TLS-intercepting proxy, set `EVAL_CA_BUNDLE=/path/to/ca-bundle.pem` in `.env`.
- **A package fails to install with 403.** A corporate proxy may block some npm packages. This project already avoids `express` / `@fastify/static` for that reason.
- **`pnpm start` fails on Python.** Install Python 3.11+, e.g. `brew install python@3.12`.
- **To start over**, delete `data/`. To reinstall Hermes, delete `.venv/`.
