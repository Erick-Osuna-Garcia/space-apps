from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from nisar_pipeline.config import load_config

ROOT = Path(__file__).resolve().parents[1]


def test_repo_config_is_valid():
    cfg = load_config(ROOT / "regions.yaml")
    ids = {r.id: r for r in cfg.regions}
    assert set(ids) == {"mexicali", "tijuana"}
    assert [layer.id for layer in ids["mexicali"].layers] == ["subsidence"]
    assert [layer.id for layer in ids["tijuana"].layers] == ["subsidence"]
    assert cfg.output_dir == (ROOT.parent / "public" / "data").resolve()


def _write(tmp_path, data):
    p = tmp_path / "regions.yaml"
    p.write_text(yaml.safe_dump(data))
    return p


def _base():
    return yaml.safe_load((ROOT / "regions.yaml").read_text())


def test_rejects_poi_outside_bbox(tmp_path):
    data = _base()
    data["regions"][1]["pois"][0]["lon"] = -100
    with pytest.raises(ValidationError, match="fuera del bbox"):
        load_config(_write(tmp_path, data))


def test_rejects_inverted_bbox(tmp_path):
    data = _base()
    data["regions"][0]["bbox"] = [-115.0, 32.2, -115.65, 32.75]
    with pytest.raises(ValidationError):
        load_config(_write(tmp_path, data))


def test_rejects_unknown_layer_type(tmp_path):
    data = _base()
    data["regions"][0]["layers"][0]["type"] = "crop-cycles"
    with pytest.raises(ValidationError):
        load_config(_write(tmp_path, data))


def test_rejects_duplicate_region_ids(tmp_path):
    data = _base()
    data["regions"][1]["id"] = "mexicali"
    with pytest.raises(ValidationError, match="duplicados"):
        load_config(_write(tmp_path, data))
