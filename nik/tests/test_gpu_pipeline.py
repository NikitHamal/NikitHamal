"""Unit tests for the GPU pipeline (run on CPU):  python nik/tests/test_gpu_pipeline.py"""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import train_gpu as tg

EN = ("The river flows through the valley and the people of the village use the water for their fields. In the summer the water is low "
      "but when the rain comes it is high and they can make use of it for all of the crops that they have been growing over the years. ") * 2
NE = ("ma aaja bazaar gaeko thiye ra tyaha ko dokan ma dherai kura thiyo. timro ghar kaha chha bhanera sodhda usle ek kura bhane ra "
      "hami sabai le yo kura bujhera aba pachhi k garne bhanera sochyau, mero sathi le pani tyo nai garchha bhanyo. ") * 2


class T(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(tg.classify(EN), "en")
        self.assertEqual(tg.classify(NE), "ne")
        self.assertIsNone(tg.classify("राम घर गयो " * 40))
        self.assertIsNone(tg.classify("short text"))

    def test_curate_filters_and_balances(self):
        docs = [EN, EN, EN.replace("river", "stream"), NE + "x", "buy now " * 100, "1234 5678 " * 100, "राम " * 200]
        docs += [f"{NE} unique{i} {'ek dui tin char paanch chha ma ko ra ' * 4}" + " ".join(f"w{i}_{j}" for j in range(30)) for i in range(6)]
        out, st = tg.curate(docs, en_frac=0.5, min_chars=100)
        self.assertEqual(st["read"], len(docs))
        self.assertGreaterEqual(st["exact_dup"] + st["near_dup"], 1)
        self.assertGreaterEqual(st["bad_lang"], 1)
        self.assertGreaterEqual(st["bad_quality"], 1)
        self.assertGreater(st["kept_en"], 0); self.assertGreater(st["kept_ne"], 0)
        self.assertEqual(len(out), st["kept_en"] + st["kept_ne"])

    def test_plan_commands_reference_real_files(self):
        root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        for prof in tg.PROFILES:
            for name, cmd, out in tg.plan(prof):
                for tok in cmd.split():
                    if tok.endswith(".py") or tok.endswith(".mjs"):
                        self.assertTrue(os.path.exists(os.path.join(root, tok)), f"{name}: {tok} missing")

    def test_smoke_train_export_run(self):
        r = tg.smoke(steps=3)
        self.assertLess(r["losses"][-1], r["losses"][0])
        self.assertTrue(r["js_ok"])
        self.assertGreater(r["fp32_vs_int8_top1_agreement"], 0.5)
        print("smoke:", r)


if __name__ == "__main__":
    unittest.main(verbosity=2)
