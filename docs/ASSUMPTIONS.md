# Assumptions

Everything this project assumes, in one place. Each assumption says *why* it was made and *what would change* if it turned out to be wrong.

## About Hermes Agent

1. **Hermes v0.15.2 is pinned** (`scripts/start.mjs`, `HERMES_VERSION`). It was the newest version on PyPI at build time (Oct 2026). Hermes moves fast, so pinning keeps results comparable over time. To upgrade, change the constant and re-run the parser tests.
2. **The online docs are ahead of PyPI.** They describe `hermes chat --oneshot --format stream-json`, which 0.15.2 does not have. We use what 0.15.2 actually provides:
   - `hermes -z "<prompt>" -m <model> --provider openai-api -t <toolsets>` runs one task headless, auto-approves tools, and prints the final answer.
   - `hermes sessions export <file>` exports the full conversation, tokens and cost from the session store inside `HERMES_HOME`.

   If a future version adds stream-json, only `4-execute.ts` and `infrastructure/hermes/hermes-session.ts` need to change.
3. **`hermes -z` exits with code 0 even when the model API fails.** A run therefore counts as `done` only when the exported session contains an assistant answer. Everything else is `error`.
4. **`HERMES_HOME` isolates a run completely.** Config, memory, skills, the session store and logs all live under it. We also strip any `HERMES_*` variables from the environment so your own Hermes settings can't leak in. Your `~/.hermes` is never touched.
5. **Config keys** used in the generated `config.yaml` were checked against 0.15.2's defaults: `model.default`, `model.provider`, `agent.max_turns`, `memory.memory_enabled`, `memory.user_profile_enabled` and `terminal.backend/cwd`.
6. **Skills** are discovered from `HERMES_HOME/skills/<name>/SKILL.md`, using frontmatter `name` and `description`. The agent sees a skills index and loads a skill with the `skill_view` tool. `hermes -z` has no "preload skills" flag, so whether the agent *chooses* to load a skill is part of what's being tested. The `used_skill` process check shows whether it did.
7. **Memory** is a fixed seed written to `HERMES_HOME/memories/MEMORY.md` (entries separated by `§`; our seed files use `---`). Memory is **off** (`memory_enabled: false`) for configs without a seed.
8. **Cost** comes from Hermes's own numbers (`actual_cost_usd`, falling back to `estimated_cost_usd`). When neither is available, it is computed as tokens × the config's `price`. The UI shows which source was used.
9. **Not yet verified against a live model.** The build environment's network sandbox blocked calls to the OpenAI API. Everything up to the API call was verified with the real Hermes binary: install, CLI flags, home layout and the session export format. The full pipeline was verified end to end with a fake Hermes binary. The first real run should be watched closely.

9a. **We call the OpenAI API directly.** Hermes's built-in `openai-api` provider reads `OPENAI_API_KEY` and sends requests to `https://api.openai.com/v1`; a request dump in the spike showed it using the Responses API (`/v1/responses`). Model ids are plain OpenAI ids. The provider is set in one place, `apps/api/src/config/model-provider.ts`. Any `OPENROUTER_API_KEY` in your shell is removed before Hermes starts, so it can't pick a different provider.

## About evaluation

10. **Memory means seeded memory only.** Every run starts from the same snapshot. "Learning over time", where memory carries across runs, is out of scope because it makes runs depend on each other.
11. **Runs are independent.** The bootstrap depends on this, and step 3 (a fresh home and workspace per run) guarantees it.
12. **Only outcome checks decide the score.** Cost and time are compared separately, and process checks are diagnostics only. Scores are in [0, 1]. A run that times out or errors scores 0 but keeps its status, so "wrong answer" and "broken run" stay distinguishable.
13. **Partial credit.** `answer_json` and `file_json` score the fraction of expected top-level fields that matched. A run "passes" when `score ≥ passThreshold` (default 1).
14. **Fair matching.** Strings are compared ignoring case and whitespace. Numbers accept numeric strings and an absolute `tolerance`. Expected objects are subsets, and arrays must match in order.
15. **Statistics.** Paired by task, with a two-level bootstrap (tasks, then trials), 10,000 iterations, 95% CI and a fixed seed (42), so reports are reproducible. Verdicts are better / worse / inconclusive. There are no per-task significance tests: per-task numbers are descriptive.
16. **The cost estimate is rough.** It assumes about 40k input and 1.5k output tokens per run, because Hermes re-sends a large system prompt and tool schemas on every model call. Real costs are shown per run.
17. **The sample model** is `gpt-4.1-mini` in all three configs (`baseline`, `open-book`, `mapping-skill`), a tool-capable OpenAI model with a published list price. Keeping the model fixed means each config changes one thing. Edit `configs/*.yaml` to use others.
18. **The sample has no memory seed.** The memory feature works (see 7 and 10), but none of the three sample configs uses it, so memory is off in every sample run.

25. **pass^k** is the share of tasks where every trial passed. The "trials to settle it" estimate assumes the CI half-width shrinks with 1/√n, which only accounts for trial noise, not task-to-task variation, so it's labelled rough and capped at 30.
26. **Task diff** counts any change in a task's mean score as improved or regressed. These counts are descriptive. The confidence interval is what decides the verdict.
27. **Retrying broken runs** replaces only runs that timed out or errored (or never finished). Successful runs are kept, so a retried experiment mixes runs from two points in time. That is acceptable for infrastructure failures, and the experiment records how many retries happened.
28. **The simulated agent** (`apps/api/simulator/simulated-hermes.mjs`) is scripted and makes no model calls. In demo mode its answers are random, seeded per run, to mimic agent variance. Experiments that use it are stored with `agent: "simulated"` and labelled SIMULATED in the UI and CLI. A retry of a simulated experiment stays simulated.

## About running it

19. **One user, one machine, no login.** Supported on macOS and Linux. Windows is supported via WSL2.
20. **Trusted tasks only.** Hermes's terminal tool runs **on your machine** (local backend), inside the run's workspace folder. That folder is not a sandbox. This is acceptable only because the tasks and fixtures are ours and in the repo. Don't point this at untrusted content without switching Hermes to a sandboxed backend (e.g. Docker).
21. **The API key is never written to disk** by the platform. It's passed to Hermes as an environment variable per run.
22. **The filesystem is the state.** There is no database: each experiment is a folder of JSON files. If the server stops mid-experiment, that experiment is marked failed on restart, and you can re-run it. Resuming is future work.
23. **Fixture files are read from the repo at run time.** The definitions snapshot freezes task, config, skill and memory *text*, but not the fixture files. Don't edit fixtures while an experiment is running.
24. **Fastify instead of Express.** The corporate network this was built on blocks the npm packages `content-type` and `content-disposition`, which Express and `@fastify/static` need. NestJS's Fastify adapter avoids them, and the built UI is served with a few lines of our own code.

## About the Indian criminal law suite

29. **Source text.** The fixture is the BNS as enacted (Gazette of India, 25 Dec 2023, as published by PRS Legislative Research). India Code's consolidated copy (current to Oct 2025) wasn't reachable when this was built. None of the sections the tasks use are known to have been amended, but re-check against India Code before relying on results.
30. **Expected answers** were taken from the Act's text: the section number of the main provision, without sub-sections (e.g. murder → 103, theft max → 3 years under 303(2)). IPC → BNS pairs follow the official BPR&D correspondence and were checked by reading the BNS section. Published conversion tables are known to disagree in places, especially sexual offences, which the suite deliberately leaves out.
31. **Not legal advice.** The suite measures agents; it isn't a reference for practice.

