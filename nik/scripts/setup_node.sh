#!/usr/bin/env bash
# Prepare a fresh GPU node for Nik (B200/B300/H100/MI355X). Idempotent.
#   bash nik/scripts/setup_node.sh && source .venv/bin/activate && BUDGET_MIN=150 bash nik/scripts/cluster_run.sh
# Picks the newest PyTorch CUDA wheel the driver supports and VERIFIES it runs on this GPU
# (B300 = Blackwell Ultra sm_103 needs kernels built for sm_100/sm_103; older wheels fail or fall back).
set -euo pipefail
cd "$(dirname "$0")/../.."
nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv,noheader 2>/dev/null | head -2 || echo "nvidia-smi unavailable (AMD node? set ROCM=1)"
PY=${PYTHON:-python3}
[ -d .venv ] || $PY -m venv .venv
source .venv/bin/activate
python -m pip -q install --upgrade pip

verify() {
python - <<'PY'
import sys, torch
assert torch.cuda.is_available(), "no CUDA device visible to torch"
cap = torch.cuda.get_device_capability(0)
arch = f"sm_{cap[0]}{cap[1]}"
built = torch.cuda.get_arch_list()
x = torch.randn(4096, 4096, device="cuda", dtype=torch.bfloat16)
y = (x @ x).float().sum().item()
q = torch.randn(8, 12, 640, 32, device="cuda", dtype=torch.bfloat16)
m = torch.zeros(640, 640, device="cuda", dtype=torch.bfloat16)
torch.nn.functional.scaled_dot_product_attention(q, q, q, attn_mask=m)
torch.cuda.synchronize()
print(f"OK torch {torch.__version__} cuda {torch.version.cuda} | {torch.cuda.device_count()}x {torch.cuda.get_device_name(0)} {arch} | wheel archs {built}")
PY
}

if [ "${ROCM:-0}" = "1" ]; then
  python -m pip -q install torch --index-url https://download.pytorch.org/whl/rocm6.4
elif ! python -c "import torch" 2>/dev/null || ! verify >/dev/null 2>&1; then
  ok=0
  for cu in cu130 cu129 cu128; do
    echo "trying PyTorch wheel $cu ..."
    python -m pip -q install --upgrade torch --index-url "https://download.pytorch.org/whl/$cu" && verify && { ok=1; break; }
    echo "  $cu does not run on this GPU/driver, trying next"
  done
  [ "$ok" = "1" ] || { echo "no PyTorch wheel verified on this GPU (check driver: CUDA 13 wheels need driver >= 580)"; exit 1; }
fi
verify
python -m pip -q install numpy pyarrow kaggle
echo "node ready: source .venv/bin/activate && BUDGET_MIN=150 bash nik/scripts/cluster_run.sh"
