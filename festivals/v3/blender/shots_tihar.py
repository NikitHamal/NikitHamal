"""Tihar: shot -> (set builder, kwargs) and keyframe plan (camera u, [key u], dissolve seconds)."""
import sets_b as B_
import sets_c as C_
import sets_t as T_

SHOTS = {
    1: (T_.set_valley_glow, dict(variant="grow")), 2: (T_.set_valley_glow, dict(variant="full")),
    3: (T_.set_yama, dict(variant="shadow")), 4: (T_.set_yama, dict(variant="pour")), 5: (T_.set_yama, dict(variant="close")),
    6: (T_.set_yama, dict(variant="calm")), 7: (T_.set_crows, {}), 9: (T_.set_gai_laxmi, {}),
    10: (B_.set_lamps_tools, dict(cut=1.5)), 11: (B_.set_lane, {}), 12: (T_.set_ox, {}), 13: (C_.set_mha, {}),
    14: (T_.set_mha_top, {}), 15: (C_.set_bhai, {}), 16: (T_.set_yama, dict(variant="complete")),
    17: (T_.set_valley_glow, dict(variant="full")), 18: (T_.set_rangoli_top, {}), 19: (T_.set_rangoli_top, {}),
}
KEYS = {
    1: (0.5, [0.05, 0.3, 0.55, 0.85], 0.9), 2: (0.5, [0.5], 0), 3: (0.6, [0.15, 0.75], 1.4), 4: (0.5, [0.12, 0.4, 0.68, 0.95], 0.9),
    5: (0.5, [0.5], 0), 6: (0.5, [0.15, 0.85], 1.4), 7: (0.5, [0.2, 0.55, 0.85], 0.5), 9: (None, [0.2, 0.75], 0.5),
    10: (0.5, [0.5], 0), 11: (0.5, [0.5], 0), 12: (0.5, [0.5], 0), 13: (0.5, [0.5], 0), 14: (0.5, [0.5], 0),
    15: (0.5, [0.5], 0), 16: (0.5, [0.5], 0), 17: (0.5, [0.5], 0), 18: (0.5, [0.5], 0),
}
