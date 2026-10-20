"""Corpus v2 source and licence registry.

A source may enter a training mix only if its licence allows redistributing a
derived model. `validate()` is a hard gate for `audit.py`: a missing source,
an unknown/TBD licence, an NC/ND licence, or an unverified entry fails.

The fetch+clean owner fills `license`, `license_url` and `verified` after
checking the primary source; this file must not guess a licence.
"""
from __future__ import annotations

SOURCES = {
    'sakonii_news': {
        'license': 'Apache-2.0',
        'license_url': 'https://huggingface.co/datasets/Sakonii/nepalitext-language-model-dataset',
        'verified': True,
        'note': 'already used for the 0.1 corpus',
    },
    'wikipedia_ne': {
        'license': 'CC-BY-SA-4.0',
        'license_url': 'https://dumps.wikimedia.org/',
        'verified': True,
        'note': 'already used for the 0.1 corpus; share-alike applies to the derived text',
    },
    'culturax_ne': {
        'license': 'TBD',
        'license_url': '',
        'verified': False,
        'note': 'CulturaX aggregates per-source licences; must be checked source by source',
    },
    'oscar_ne': {
        'license': 'TBD',
        'license_url': '',
        'verified': False,
        'note': 'licence depends on the crawl/subset',
    },
    'indiccorp_ne': {
        'license': 'TBD',
        'license_url': '',
        'verified': False,
        'note': 'check the AI4Bharat dataset card for the Nepali subset',
    },
    'madlad_ne': {
        'license': 'TBD',
        'license_url': '',
        'verified': False,
        'note': 'check the MADLAD-400 dataset card',
    },
}

ALLOWED = (
    'apache-2.0', 'mit', 'bsd-2-clause', 'bsd-3-clause', 'cc0-1.0', 'public domain',
    'cc-by-4.0', 'cc-by-sa-4.0', 'cc-by-3.0', 'cc-by-sa-3.0', 'odc-by-1.0', 'odbl-1.0',
)
BLOCKED_MARKERS = ('nc', 'nd', 'noncommercial', 'non-commercial', 'no derivative', 'research only', 'tbd', 'unknown')


def normalize_license(value):
    return (value or '').strip().lower().replace('_', '-')


def validate(seen_sources, require_verified=True):
    """Return (errors, warnings) for the sources actually present in the corpus."""
    errors, warnings = [], []
    for name in sorted(set(seen_sources)):
        entry = SOURCES.get(name)
        if entry is None:
            errors.append(f'{name}: not in the licence registry')
            continue
        lic = normalize_license(entry.get('license'))
        if any(marker in lic for marker in BLOCKED_MARKERS):
            errors.append(f'{name}: licence {entry.get("license")!r} is missing/NC/ND/TBD')
            continue
        if lic not in ALLOWED:
            errors.append(f'{name}: licence {entry.get("license")!r} is not in the allow-list; add it only after checking the primary source')
            continue
        if require_verified and not entry.get('verified'):
            errors.append(f'{name}: licence {entry.get("license")!r} has not been verified against the source')
        if not entry.get('license_url'):
            warnings.append(f'{name}: no licence_url recorded')
    return errors, warnings
