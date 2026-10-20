# Agents: start here

This repo is Nikit Hamal's portfolio site (GitHub Pages) plus **Nik**, a from-scratch tiny LLM and TTS
that run in the browser at `/chat`.

- Read `nik/CONTINUITY.md` first: goals, rules, current state, open tasks, how to push.
- Code and docs for Nik live in `nik/` (`nik/README.md`, `nik/docs/`).

## Must-do rules (set by the owner, follow strictly)
1. **No subagents.** Do the work yourself. If one is truly unavoidable, run at most ONE at a time, never in parallel.
2. **No external/open-weight teacher models** (no Gemma, Qwen, Llama, API LLMs, ...). The coding agent itself is Nik's
   teacher: it writes the gold data and the generators by hand. Public datasets (Wikipedia, news) are fine.
3. **Branch:** Claude Code / Opus agents push directly to `main`; any other agent pushes to a new branch.
4. **Never delete, revert or overwrite other agents' files or commits** (e.g. `festivals/`). Fetch + fast-forward first,
   push only your own changed paths.
5. **Never commit credentials** (Kaggle, GitHub, molab tokens) to the repo, logs or notebooks.
6. Local sandbox training runs are at most ~20 min. Longer runs go to molab / Kaggle / Colab; push code + docs first.
7. **Keep free GPUs busy.** While writing data or code, keep the molab/Kaggle GPU running useful jobs (detached, so a
   cell interrupt cannot kill them) and show live progress in the notebook.
8. Push often: code, pipelines, docs, tools, logs, trained models. Ship a model only if it beats the live one on
   NikBench + understanding probes + eval.py.
9. Every reply in `/chat` must come from the model (no if/else or preset replies).
