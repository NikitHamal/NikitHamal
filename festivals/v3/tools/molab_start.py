# Paste into the molab notebook via `marimo pair` (execute-code.sh), never run locally. It starts the v3 build detached
# (so a cell interrupt or a pair disconnect cannot kill it) and returns at once; progress: tail /tmp/fv3/build/logs/*.log
import os, subprocess
R = "/tmp/fv3"
if not os.path.isdir(R):
    subprocess.run(["git", "clone", "-q", "--depth", "1", "-b", "agent-b/festivals-v3", "https://github.com/NikitHamal/NikitHamal.git", R], check=True)
else:
    subprocess.run(["git", "-C", R, "pull", "-q"], check=True)
STAGES = os.environ.get("FV3_STAGES", "setup dem type audio")
log = open(f"{R}/festivals/v3/build_{STAGES.split()[-1]}.log", "a")
p = subprocess.Popen(["bash", f"{R}/festivals/v3/build.sh", *STAGES.split()], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
print("started pid", p.pid, "stages", STAGES)
