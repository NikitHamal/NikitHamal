"""Router tests: features, model, data labels, and the int8 artifact predictions."""
import sys
import unittest
from pathlib import Path

import numpy as np
import torch

DEC = Path(__file__).resolve().parents[1] / 'decision'
sys.path.insert(0, str(DEC))
import router  # noqa: E402


class RouterTests(unittest.TestCase):
    def test_featurize(self):
        v = router.featurize('mero naam nikit ho')
        self.assertEqual(v.shape, (router.DIM,))
        self.assertAlmostEqual(float(np.linalg.norm(v)), 1.0, places=5)

    def test_model_forward(self):
        out = router.Router()(torch.zeros(1, router.DIM))
        self.assertEqual(tuple(out.shape), (1, len(router.LABELS)))

    def test_label_of_minimal_pairs(self):
        self.assertEqual(router.label_of('mero naam nikit ho'), 'user_name')
        self.assertEqual(router.label_of('nikit ko ho?'), 'creator')
        self.assertEqual(router.label_of('mero sathi nikit ho, usko naam k ho?'), 'third_person')
        self.assertEqual(router.label_of('timi ko hau?'), 'assistant')
        self.assertEqual(router.label_of('nikit'), 'ambiguous')

    def test_int8_artifact(self):
        path = DEC / 'router_int8.npz'
        if not path.exists():
            self.skipTest('router artifact not built')
        W1, b1, W2, b2, labels = router._load_npz(str(path))
        def pred(t):
            x = router.featurize(t)
            return labels[int(np.argmax(W2 @ np.maximum(W1 @ x + b1, 0) + b2))]
        self.assertEqual(pred('mero naam nikit ho'), 'user_name')
        self.assertEqual(pred('nikit ko ho?'), 'creator')


if __name__ == '__main__':
    unittest.main()
