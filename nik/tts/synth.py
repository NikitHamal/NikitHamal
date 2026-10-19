"""Text -> wav with trained NikTTS checkpoints.
    python nik/tts/synth.py --run nik/runs/tts --text "namaste! ma nik ho." --out hello.wav
"""
import argparse, os, sys
import numpy as np
import torch
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from model import Acoustic, TTSConfig, Vocoder  # noqa: E402
from text import encode  # noqa: E402


def load(run, dev='cpu'):
    ca = torch.load(os.path.join(run, 'acoustic.pt'), map_location='cpu', weights_only=False)
    cv = torch.load(os.path.join(run, 'vocoder.pt'), map_location='cpu', weights_only=False)
    A = Acoustic(TTSConfig(**ca['cfg'])); A.load_state_dict(ca['model'])
    V = Vocoder(TTSConfig(**cv['cfg'])); V.load_state_dict(cv['model'])
    return A.to(dev).eval(), V.to(dev).eval(), ca.get('speakers', [])


@torch.no_grad()
def synth(A, V, text, spk=0, speed=1.0):
    x = torch.tensor([encode(text)])
    m = A.infer(x, torch.tensor([spk]), speed)
    w = V(m)[0].numpy()
    return w / max(1e-4, np.abs(w).max()) * 0.9


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', default='nik/runs/tts')
    ap.add_argument('--text', required=True)
    ap.add_argument('--spk', type=int, default=0)
    ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--out', default='nik_tts.wav')
    a = ap.parse_args()
    import soundfile as sf
    A, V, _ = load(a.run)
    sf.write(a.out, synth(A, V, a.text, a.spk, a.speed), 22050)
    print('wrote', a.out)
