import logging
from contextlib import contextmanager

import numpy as np
import pytest

from nisar_pipeline.config import load_config
from nisar_pipeline.discover import Discovery, Product
from nisar_pipeline.download import (
    CredentialsError,
    credential_source,
    fetch_subsets,
    require_credentials,
)
from nisar_pipeline.grid import make_grid
from nisar_pipeline.nisar import plan_nisar

from .gunw_fixture import product_axes, write_gunw
from .test_config import ROOT

GRID = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 32)
SECRET = "s3cr3t-P4ss"


def test_no_credentials(tmp_path):
    assert credential_source({}, tmp_path / "missing") is None
    with pytest.raises(CredentialsError, match="urs.earthdata.nasa.gov"):
        require_credentials({}, tmp_path / "missing")


def test_env_and_netrc_sources(tmp_path):
    assert credential_source({"EARTHDATA_TOKEN": "t"}, tmp_path / "x") == "environment"
    assert credential_source({"EARTHDATA_USERNAME": "u", "EARTHDATA_PASSWORD": "p"}) == "environment"
    rc = tmp_path / "netrc"
    rc.write_text(f"machine urs.earthdata.nasa.gov login me password {SECRET}\n")
    rc.chmod(0o600)
    assert credential_source({}, rc) == "netrc"


def test_error_message_does_not_leak_secrets(tmp_path):
    with pytest.raises(CredentialsError) as exc:
        require_credentials({"EARTHDATA_USERNAME": "me"}, tmp_path / "missing")
    assert SECRET not in str(exc.value)


def _products(tmp_path, n=2):
    x, y = product_axes(GRID)
    ps = []
    dates = ["2025-10-29", "2025-11-10", "2025-11-22"]
    for k in range(n):
        p = np.zeros((y.size, x.size), np.float32)
        path = write_gunw(tmp_path / f"g{k}.h5", x, y, p, p + 0.9, ref=dates[k], sec=dates[k + 1])
        ps.append(Product(f"PROD{k}", str(path), dates[k], dates[k + 1], 5, 18, "ASCENDING", "", 1, True))
    return ps


def test_cache_skips_complete_products(tmp_path):
    products = _products(tmp_path)
    opened = []

    @contextmanager
    def opener(url):
        opened.append(url)
        with open(url, "rb") as f:
            yield f

    cache = tmp_path / "cache"
    first = fetch_subsets(products, GRID, cache, opener)
    assert len(opened) == 2 and len(first) == 2
    assert not list(cache.glob("*.tmp.npz"))
    fetch_subsets(products, GRID, cache, opener)
    assert len(opened) == 2  # segunda vez: todo desde caché


def test_plan_aborts_before_download_without_credentials(tmp_path, monkeypatch):
    for k in ["EARTHDATA_TOKEN", "EARTHDATA_USERNAME", "EARTHDATA_PASSWORD"]:
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("NETRC", str(tmp_path / "missing"))
    cfg = load_config(ROOT / "regions.yaml")
    cfg.cache_dir = tmp_path
    region = cfg.regions[0]
    disc = Discovery("mexicali", "subsidence", {}, [], None, _products(tmp_path))
    with pytest.raises(CredentialsError):
        plan_nisar(cfg, region, region.layers[0], discovery=disc)
    assert (tmp_path / "mexicali/subsidence/discovery.json").is_file()
    assert not (tmp_path / "mexicali/subsidence/subsets").exists()


def test_logs_never_contain_secret(tmp_path, monkeypatch, caplog):
    monkeypatch.setenv("EARTHDATA_USERNAME", "me")
    monkeypatch.setenv("EARTHDATA_PASSWORD", SECRET)
    cfg = load_config(ROOT / "regions.yaml")
    cfg.cache_dir = tmp_path
    region = cfg.regions[0]
    products = _products(tmp_path)
    disc = Discovery("mexicali", "subsidence", {}, [], None, products)

    @contextmanager
    def opener(url):
        with open(url, "rb") as f:
            yield f

    with caplog.at_level(logging.DEBUG):
        plan = plan_nisar(cfg, region, region.layers[0], discovery=disc, opener=opener)
        cube = plan.build(GRID)
    assert cube.shape == (3, GRID.height, GRID.width)
    assert SECRET not in caplog.text
    for f in tmp_path.rglob("*"):
        if f.is_file() and f.suffix in {".json", ".npz"}:
            assert SECRET.encode() not in f.read_bytes()
