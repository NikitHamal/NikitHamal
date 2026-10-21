"""Unit tests for nik/scripts/model_budget.py (Local-C, issue #9).

    python -m unittest discover -s nik/tests -v

Runs in well under a second and needs no torch, no GPU and no model file.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts'))
from model_budget import PRESETS, budget, gpu_minutes, tokens_per_param  # noqa: E402


def cfg(name, **kw):
    c = dict(PRESETS[name])
    c['name'] = name
    c['ternary'] = name.endswith('t')
    c.update(kw)
    return c


class TestBudget(unittest.TestCase):
    def test_nik_01_params_and_file(self):
        b = budget(cfg('nik-0.1'))
        self.assertAlmostEqual(b['params'] / 1e6, 20.47, places=1)
        # int8 weights + per-row scales + f32 norms: under the 30 MB cap
        self.assertGreater(b['file_bytes'], 20e6)
        self.assertLess(b['file_bytes'], 30e6)

    def test_ternary_preset_fits_the_same_budget(self):
        """nik-0.2t: 3.5x the parameters in (about) the same bytes as nik-0.1."""
        a = budget(cfg('nik-0.1'))
        t = budget(cfg('nik-0.2t'))
        self.assertGreater(t['params'] / a['params'], 3.4)
        self.assertLess(t['file_bytes'], 30e6)
        # the 2-bit file is not bigger than the int8 file of the 20.5M model
        self.assertLess(t['file_bytes'], a['file_bytes'] * 1.05)

    def test_fp_format_is_the_size_cap_violation(self):
        f = budget(cfg('nik-0.2f'), 'fp32')
        self.assertGreater(f['file_bytes'], 30e6)

    def test_kv_cache_is_a_first_class_cost(self):
        """The KV cache is f32 per layer in nik.js and is not covered by the file cap."""
        a = budget(cfg('nik-0.1'))
        self.assertGreater(a['kv_f32_bytes'], 10e6)
        self.assertLess(a['kv_int8_bytes'], a['kv_f32_bytes'])
        # depth costs KV cache: n_repeat 3 needs 1.5x the cache of n_repeat 2
        r3 = budget(cfg('nik-0.1r3'))
        self.assertAlmostEqual(r3['kv_f32_bytes'] / a['kv_f32_bytes'], 1.5, places=2)

    def test_flops_scale_with_the_model(self):
        a = budget(cfg('nik-0.1'))
        d = budget(cfg('nik-0.1r3'))
        t = budget(cfg('nik-0.2t'))
        # n_repeat 3 adds 50% of the *block* FLOPs; the tied embedding is a constant,
        # so the whole-model ratio is slightly under 1.5.
        self.assertAlmostEqual(d['gflops_per_token'] / a['gflops_per_token'], 1.48, places=2)
        self.assertGreater(t['gflops_per_token'] / a['gflops_per_token'], 3.5)

    def test_token_budget_columns(self):
        b = budget(cfg('nik-0.2t'))
        # 300M tokens is token-matched but far from Chinchilla for the 73M model
        self.assertLess(tokens_per_param(b, 3e8), 5.0)
        self.assertGreater(tokens_per_param(budget(cfg('nik-0.1')), 3e8), 14.0)
        # Chinchilla-optimal token count scales with the parameters
        self.assertAlmostEqual(b['chin_tokens'] / budget(cfg('nik-0.1'))['chin_tokens'],
                               b['params'] / budget(cfg('nik-0.1'))['params'], places=6)

    def test_gpu_minutes_scale_with_flops(self):
        a = budget(cfg('nik-0.1'))
        t = budget(cfg('nik-0.2t'))
        self.assertGreater(gpu_minutes(t, 3e8) / gpu_minutes(a, 3e8), 3.0)

    def test_ctx_scales_the_kv_cache(self):
        a = budget(cfg('nik-0.1'))
        b = budget(cfg('nik-0.1'), ctx=256)
        self.assertAlmostEqual(b['kv_f32_bytes'] * 2, a['kv_f32_bytes'], places=0)

    def test_nik_01w_uses_the_unused_budget(self):
        """nik-0.1w (14 unique blocks) still fits; the cap is now 30 MB (owner, 2026-10-21)."""
        a = budget(cfg('nik-0.1'))
        w = budget(cfg('nik-0.1w'))
        self.assertLess(w['file_bytes'], 30e6)
        self.assertGreater(w['params'] / a['params'], 1.1)
        self.assertGreater(w['gflops_per_token'] / a['gflops_per_token'], 1.1)
        self.assertLess(w['gflops_per_token'] / a['gflops_per_token'], 1.25)

    def test_the_30mb_presets_fit_and_are_bigger(self):
        """nik-0.1x (depth) and nik-0.1v (width) must fit the new 30 MB cap and be
        materially bigger than the shipped nik-0.1 - the owner raised the cap so the
        model can have real capacity for composing two steps."""
        a = budget(cfg('nik-0.1'))
        x = budget(cfg('nik-0.1x'))
        v = budget(cfg('nik-0.1v'))
        self.assertLess(x['file_bytes'], 30e6)
        self.assertLess(v['file_bytes'], 30e6)
        self.assertGreater(x['params'] / a['params'], 1.35)
        self.assertGreater(v['params'] / a['params'], 1.2)
        # depth: 17 unique blocks x 2 repeats = 34 effective layers
        self.assertEqual(x['n_unique'] * x['n_repeat'], 34)
        # width: d=448 (the head dim stays 32, so the KV cache does not grow)
        self.assertEqual(PRESETS['nik-0.1v']['d'], 448)
        self.assertEqual(v['head_dim'], a['head_dim'])

    def test_fit_finds_the_same_block_count_as_the_preset(self):
        """the shipped preset must be exactly the config that --fit finds (the cap is
        a bytes cap, so --fit scales the block count until the file reaches it)."""
        from model_budget import fit
        f = fit('nik-0.1')
        # with the 30 MB cap the largest d=384 shape is 17 unique blocks = the
        # nik-0.1x preset
        self.assertEqual(f['n_unique'], 17)
        self.assertEqual(f['n_repeat'], 2)
        self.assertLessEqual(f['file_bytes'], 30e6)
        self.assertEqual(f['n_unique'], budget(cfg('nik-0.1x'))['n_unique'])


if __name__ == '__main__':
    unittest.main()
