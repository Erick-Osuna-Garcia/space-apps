import json
from types import SimpleNamespace

import pytest

from nisar_pipeline.config import load_config
from nisar_pipeline.discover import DiscoveryError, discover, write_report

from .test_config import ROOT

CP = (-115.24, 32.40)
FOOT = {"type": "Polygon", "coordinates": [[[-116, 32], [-114.5, 32], [-114.5, 33], [-116, 33], [-116, 32]]]}
AWAY = {"type": "Polygon", "coordinates": [[[-115.6, 32.6], [-115.5, 32.6], [-115.5, 32.7], [-115.6, 32.7], [-115.6, 32.6]]]}


def _res(ref, sec, orbit=5, frame=18, foot=FOOT, proc="2026-10-01"):
    name = (f"NISAR_L2_PR_GUNW_032_{orbit:03d}_A_{frame:03d}_033_4000_SH_{ref}T125110_{ref}T125145_"
            f"{sec}T125110_{sec}T125145_P05023_N_F_J_001")
    return SimpleNamespace(
        geometry=foot,
        properties={"sceneName": name, "url": f"https://x/{name}.h5", "pathNumber": orbit,
                    "frameNumber": frame, "flightDirection": "ASCENDING", "processingDate": proc,
                    "bytes": {f"{name}.h5": {"bytes": 10}, f"{name}.png": {"bytes": 1}}},
    )


def _layer():
    cfg = load_config(ROOT / "regions.yaml")
    region = cfg.regions[0]
    return region, region.layers[0].model_copy(update={"stack": None})


def test_picks_stack_with_most_pairs_and_dedupes():
    region, layer = _layer()
    results = [
        _res("20251017", "20251029"),
        _res("20251029", "20251110", proc="2026-01-01"),
        _res("20251029", "20251110", proc="2026-09-01"),  # duplicado, más reciente
        _res("20251110", "20251122"),
        _res("20251018", "20251030", orbit=85, frame=72),
        _res("20251017", "20251029", orbit=7, frame=1, foot=AWAY),  # no cubre Cerro Prieto
    ]
    seen = {}
    d = discover(region, layer, CP, search_fn=lambda **kw: seen.update(kw) or results)
    assert seen["processingLevel"] == "GUNW"
    assert d.chosen["relative_orbit"] == 5
    assert len(d.products) == 3
    assert d.products[1].processing_date == "2026-09-01"
    assert [x.isoformat() for x in d.dates] == ["2025-10-17", "2025-10-29", "2025-11-10", "2025-11-22"]
    assert d.products[0].bytes == 10


def test_prefers_coverage_over_pair_count():
    region, layer = _layer()
    layer = layer.model_copy(update={"stack": None})
    # el stack 5 cubre Cerro Prieto pero solo una franja de la región
    narrow = {"type": "Polygon", "coordinates": [[[-115.3, 32.2], [-115.0, 32.2], [-115.0, 32.75], [-115.3, 32.75], [-115.3, 32.2]]]}
    full = {"type": "Polygon", "coordinates": [[[-116, 32], [-114, 32], [-114, 33], [-116, 33], [-116, 32]]]}
    results = [
        _res("20251017", "20251029", foot=narrow),
        _res("20251029", "20251110", foot=narrow),
        _res("20251110", "20251122", foot=narrow),
        _res("20251018", "20251030", orbit=85, frame=72, foot=full),
        _res("20251030", "20251111", orbit=85, frame=72, foot=full),
    ]
    d = discover(region, layer, CP, search_fn=lambda **kw: results)
    assert d.chosen["relative_orbit"] == 85


def test_no_results_raises_with_criteria():
    region, layer = _layer()
    with pytest.raises(DiscoveryError, match="mexicali/subsidence.*GUNW"):
        discover(region, layer, CP, search_fn=lambda **kw: [])


def test_report_written(tmp_path):
    region, layer = _layer()
    d = discover(region, layer, CP, search_fn=lambda **kw: [_res("20251017", "20251029")])
    out = write_report(d, tmp_path / "discovery.json")
    data = json.loads(out.read_text())
    assert data["dates"] == ["2025-10-17", "2025-10-29"]
    assert data["products"][0]["ref_date"] == "2025-10-17"
