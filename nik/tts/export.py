"""Export NikTTS to three ONNX graphs for the browser (onnxruntime-web), int8-quantised.

  enc.onnx  ids (1,T) int64, spk (1,) int64 -> h (1,T,d), mu (1,T,80), logd (1,T)
  dec.onnx  h_exp (1,F,d), mu_exp (1,F,80), spk (1,) -> mel (1,F,80)
  voc.onnx  mel (1,80,F) -> re (1,513,F), im (1,513,F)   (iSTFT happens in JS)

    python nik/tts/export.py --run nik/runs/tts --out nik/web/tts
"""
import argparse, json, os, sys
import numpy as np
import torch
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from synth import load  # noqa: E402
from text import SYMBOLS, NUM  # noqa: E402
import phonemes  # noqa: E402
from model import AcousticCFM  # noqa: E402


class Enc(torch.nn.Module):
    def __init__(self, A):
        super().__init__(); self.A = A
    def forward(self, ids, spk):
        return self.A.encode(ids, spk)


class Dec(torch.nn.Module):
    def __init__(self, A):
        super().__init__(); self.A = A
    def forward(self, h, mu, spk):
        pad = torch.zeros(h.shape[0], h.shape[1], dtype=torch.bool, device=h.device)
        return self.A.decode(h, mu, spk, pad)


class VField(torch.nn.Module):
    """v2: one flow-matching step's vector field; the browser runs the ODE loop."""
    def __init__(self, A):
        super().__init__(); self.A = A
    def forward(self, x, t, h, mu, spk):
        pad = torch.zeros(h.shape[0], h.shape[1], dtype=torch.bool, device=h.device)
        return self.A.vfield(x, t, h, mu, spk, pad)


class Voc(torch.nn.Module):
    def __init__(self, V):
        super().__init__(); self.V = V
    def forward(self, mel):
        return self.V.spec(mel)


def export(m, args, path, names_in, names_out, axes):
    kw = dict(input_names=names_in, output_names=names_out, dynamic_axes=axes, opset_version=17)
    try:
        torch.onnx.export(m, args, path, dynamo=False, **kw)
    except TypeError:
        torch.onnx.export(m, args, path, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', default='nik/runs/tts')
    ap.add_argument('--out', default='nik/web/tts')
    ap.add_argument('--no-quant', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    A, V, speakers = load(a.run)
    v2 = isinstance(A, AcousticCFM)
    syms = phonemes.SYMBOLS if v2 else SYMBOLS
    d = A.c.d
    ids = torch.randint(3, len(syms), (1, 23)); spk = torch.tensor([0])
    export(Enc(A), (ids, spk), f'{a.out}/enc.f32.onnx', ['ids', 'spk'], ['h', 'mu', 'logd'], {'ids': {1: 'T'}, 'h': {1: 'T'}, 'mu': {1: 'T'}, 'logd': {1: 'T'}})
    h = torch.randn(1, 57, d); mu = torch.randn(1, 57, 80)
    if v2:
        xx, tt = torch.randn(1, 57, 80), torch.tensor([0.3])
        export(VField(A), (xx, tt, h, mu, spk), f'{a.out}/dec.f32.onnx', ['x', 't', 'h', 'mu', 'spk'], ['v'],
               {'x': {1: 'F'}, 'h': {1: 'F'}, 'mu': {1: 'F'}, 'v': {1: 'F'}})
    else:
        export(Dec(A), (h, mu, spk), f'{a.out}/dec.f32.onnx', ['h', 'mu', 'spk'], ['mel'], {'h': {1: 'F'}, 'mu': {1: 'F'}, 'mel': {1: 'F'}})
    mel = torch.randn(1, 80, 57)
    export(Voc(V), (mel,), f'{a.out}/voc.f32.onnx', ['mel'], ['re', 'im'], {'mel': {2: 'F'}, 're': {2: 'F'}, 'im': {2: 'F'}})
    import onnxruntime as ort
    files = {}
    for n in ('enc', 'dec', 'voc'):
        src, dst = f'{a.out}/{n}.f32.onnx', f'{a.out}/{n}.onnx'
        if a.no_quant:
            os.replace(src, dst)
        else:
            from onnxruntime.quantization import quantize_dynamic, QuantType
            # MatMul/Gemm only: onnxruntime-web has no ConvInteger kernel; convs stay fp32
            quantize_dynamic(src, dst, weight_type=QuantType.QInt8, op_types_to_quantize=['MatMul', 'Gemm'])
            os.remove(src)
        files[n] = os.path.getsize(dst)
    # parity check against PyTorch
    s = {n: ort.InferenceSession(f'{a.out}/{n}.onnx', providers=['CPUExecutionProvider']) for n in ('enc', 'dec', 'voc')}
    with torch.no_grad():
        ids2 = torch.randint(3, len(syms), (1, 41))        # a different length than the export example
        ref = A.encode(ids2, spk)[1].numpy()
        got = s['enc'].run(None, {'ids': ids2.numpy(), 'spk': spk.numpy()})[1]
        h2, mu2 = torch.randn(1, 113, d), torch.randn(1, 113, 80)
        if v2:
            x2, t2 = torch.randn(1, 113, 80), torch.tensor([0.5])
            rd = VField(A)(x2, t2, h2, mu2, spk).numpy()
            gd = s['dec'].run(None, {'x': x2.numpy(), 't': t2.numpy(), 'h': h2.numpy(), 'mu': mu2.numpy(), 'spk': spk.numpy()})[0]
        else:
            rd = Dec(A)(h2, mu2, spk).numpy()
            gd = s['dec'].run(None, {'h': h2.numpy(), 'mu': mu2.numpy(), 'spk': spk.numpy()})[0]
        mel = torch.randn(1, 80, 113)
        rv = V.spec(mel)[0].numpy(); gv = s['voc'].run(None, {'mel': mel.numpy()})[0]
    rel = lambda r, g: float(np.abs(r - g).mean() / (np.abs(r).mean() + 1e-9))  # noqa: E731
    counts = None
    meta = {'version': 2 if v2 else 1, 'sr': 22050, 'n_fft': 1024, 'hop': 256, 'symbols': syms, 'num_words': NUM, 'speakers': speakers,
            'mel_mean': float(A.mel_mean) if v2 else 0.0, 'mel_std': float(A.mel_std) if v2 else 1.0, 'cfm_steps': 10, 'cfm_temperature': 0.667,
            'default_speaker': 0, 'bytes': files, 'parity': {'enc_mu': rel(ref, got), 'dec_mel': rel(rd, gd), 'voc_re': rel(rv, gv)}}
    json.dump(meta, open(f'{a.out}/tts.json', 'w'), indent=1)
    if v2 and os.path.exists(os.path.join(a.run, 'lexicon.json')):
        import shutil
        shutil.copy(os.path.join(a.run, 'lexicon.json'), f'{a.out}/lexicon.json')
    print(json.dumps({'bytes': files, 'total_mb': round(sum(files.values()) / 1e6, 2), 'parity': meta['parity']}, indent=1))


if __name__ == '__main__':
    main()
