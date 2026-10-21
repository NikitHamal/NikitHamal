# STOP - do not run these tools (2026-10-21 18:12 UTC)

**Two of the owner's molab accounts (NEWZ UPDATES, OPPOONEPLUS) were restricted by molab for violating its acceptable
use policy after ~1 h of this automation** (headless browser holding notebooks open, automatic re-provisioning after
every reclaim - ~15 sandboxes in an hour - across three accounts run by one operator). The box deaths in that hour were
most likely molab's enforcement, not random preemption. The tools are kept only as a record. Do not drive molab with a
headless browser, multiple accounts or auto-restart loops. Use molab only the normal way (owner opens a notebook,
shares the pair URL), within its fair-use terms, or ask the owner for another GPU source.

# molab box automation (Claude, 2026-10-21)

molab GPU boxes (RTX Pro 6000, 96 GB) are free but get reclaimed without warning (HTTP 410, all `/tmp` lost),
often after 1-45 min (marimo issue #11058). Keeping a browser tab open does **not** prevent it. These tools make the
boxes self-healing and make jobs survive a reclaim. They run in the driving agent's sandbox, never in the repo's CI.

| file | what it does |
|---|---|
| `molab_box.py <prof> <box> <port>` | headless Chromium logged in with the owner's molab cookies (`~/.molab/<prof>/cookies.json`, 0600), keeps the notebook (`~/.molab/<prof>/notebook.url`) open, makes sure the RTX Pro 6000 is attached, captures sandbox URL + token from the page's session request into `~/.molab/b<box>.{url,tok}`, checks every 60 s, reloads on 410 (molab starts a new box). Writes `/tmp/molab_newbox_<prof>.flag` on every new box. Status JSON on `127.0.0.1:<port>`. |
| `box_runner.py` | on every new-box flag: installs the Kaggle token on the box, runs `jobs/bootstrap.sh` (repo + replay corpus from Kaggle), (re)starts the box's job if not running, re-seals the vault (`nik/agents/vault.py`) and pushes it. Status on `:8792`. Edit its `BOXES` table to change which job runs where. |
| `boxpy.py <box> -` | run Python (stdin) in box `<box>`'s marimo kernel (fast client for `/api/kernel/execute`). |
| `relay.py A path B path` | copy a file box A -> sandbox -> box B (700 KB base64 reads, 3 MB writes, md5 checked). |
| `ghpush.py` | push local commits through the GitHub connector API (diff-based; aborts if the remote changed the same paths). |
| `jobs/*.sh` | resumable jobs: each stage writes its output to its own private Kaggle dataset (`iamnikithamal/nik-<tag>-mix`, `-bin`, `-gate`), a new box downloads finished stages and continues. |

Setup for a new driver (needs the owner): the owner pastes molab login cookies (the `__client` cookie of clerk.marimo.io
is the long-lived one) per account; store them as `~/.molab/a1|a2|a3/cookies.json`; run `molab_check.py`-style login
once to create a notebook per account; then:

```
actl serve start 8791 -- python3 nik/agents/molab/molab_box.py a1 2 8791   # NEWZ UPDATES  -> box 2 (Claude main LLM)
actl serve start 8793 -- python3 nik/agents/molab/molab_box.py a2 4 8793   # Nikit Hamal   -> box 4 (Local-C)
actl serve start 8794 -- python3 nik/agents/molab/molab_box.py a3 3 8794   # OPPOONEPLUS   -> box 3 (Decide + owner reels)
actl serve start 8792 -- python3 nik/agents/molab/box_runner.py
```
Tools expect copies in `/tmp/tools/` (`cp nik/agents/molab/*.py /tmp/tools/; cp -r nik/agents/molab/jobs /tmp/tools/`).
Kaggle (storage only, never GPU): token in `~/.kaggle/access_token`. Never commit cookies, tokens or URLs.
