"""Audio features for NikTTS: 22.05 kHz, 80-bin log-mel, hop 256 (11.6 ms frames)."""
import math

import numpy as np
import torch

SR, N_FFT, HOP, WIN, N_MELS, FMIN, FMAX = 22050, 1024, 256, 1024, 80, 0.0, 8000.0


def load_wav(path: str) -> np.ndarray:
    import soundfile as sf
    from scipy.signal import resample_poly
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(1)
    if sr != SR:
        g = math.gcd(sr, SR)
        x = resample_poly(x, SR // g, sr // g).astype(np.float32)
    x = x / max(1e-4, np.abs(x).max()) * 0.95
    return trim_silence(x)


def trim_silence(x: np.ndarray, top_db: float = 40, frame: int = 512) -> np.ndarray:
    n = len(x) // frame
    if n < 3:
        return x
    e = 10 * np.log10((x[: n * frame].reshape(n, frame) ** 2).mean(1) + 1e-10)
    keep = np.nonzero(e > e.max() - top_db)[0]
    if len(keep) == 0:
        return x
    a, b = max(0, keep[0] - 2) * frame, min(n, keep[-1] + 3) * frame
    return x[a:b]


def _hz_to_mel(f):
    return 2595.0 * np.log10(1.0 + f / 700.0)


def mel_basis() -> np.ndarray:
    """(N_MELS, N_FFT//2+1) triangular filters, HTK mel scale, area-normalised."""
    mels = np.linspace(_hz_to_mel(FMIN), _hz_to_mel(FMAX), N_MELS + 2)
    hz = 700.0 * (10 ** (mels / 2595.0) - 1.0)
    bins = np.linspace(0, SR / 2, N_FFT // 2 + 1)
    fb = np.zeros((N_MELS, len(bins)), dtype=np.float32)
    for i in range(N_MELS):
        lo, c, hi = hz[i], hz[i + 1], hz[i + 2]
        up = (bins - lo) / (c - lo)
        down = (hi - bins) / (hi - c)
        fb[i] = np.maximum(0, np.minimum(up, down)) * (2.0 / (hi - lo))
    return fb


_FB = None


def mel(x: torch.Tensor) -> torch.Tensor:
    """x: (B, T) waveform -> (B, N_MELS, frames) log-mel."""
    global _FB
    if _FB is None or _FB.device != x.device:
        _FB = torch.from_numpy(mel_basis()).to(x.device)
    spec = torch.stft(x, N_FFT, HOP, WIN, window=torch.hann_window(WIN, device=x.device), center=True, return_complex=True).abs()
    return torch.log(torch.clamp(_FB @ spec, min=1e-5))
