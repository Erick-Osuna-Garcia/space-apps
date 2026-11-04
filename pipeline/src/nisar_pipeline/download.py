"""Credenciales Earthdata y descarga de recortes GUNW con caché en disco.

No se descargan los HDF5 completos (~2 GB c/u): se abren por HTTPS con lectura por rangos y se
guarda solo la ventana de la región. Las credenciales nunca se loguean ni se escriben a disco.
"""

from __future__ import annotations

import hashlib
import logging
import netrc
import os
from collections.abc import Callable, Mapping
from contextlib import AbstractContextManager
from pathlib import Path
from typing import IO

import h5py

from .discover import Product
from .grid import Grid
from .gunw import GunwSubset, read_subset

log = logging.getLogger(__name__)

EDL_HOST = "urs.earthdata.nasa.gov"

HELP = (
    "Faltan credenciales de NASA Earthdata. Crea una cuenta gratuita en "
    "https://urs.earthdata.nasa.gov/users/new y configura ~/.netrc con\n"
    f"  machine {EDL_HOST} login TU_USUARIO password TU_PASSWORD\n"
    "(chmod 600 ~/.netrc), o exporta EARTHDATA_USERNAME y EARTHDATA_PASSWORD "
    "(o EARTHDATA_TOKEN). Ver pipeline/README.md."
)

Opener = Callable[[str], AbstractContextManager[IO[bytes]]]


class CredentialsError(RuntimeError):
    pass


def credential_source(
    env: Mapping[str, str] = os.environ, netrc_path: Path | None = None
) -> str | None:
    """'environment', 'netrc' o None. No devuelve ni expone los valores."""
    if env.get("EARTHDATA_TOKEN") or (env.get("EARTHDATA_USERNAME") and env.get("EARTHDATA_PASSWORD")):
        return "environment"
    path = netrc_path or Path(env.get("NETRC", Path.home() / ".netrc"))
    try:
        if netrc.netrc(path).authenticators(EDL_HOST):
            return "netrc"
    except (FileNotFoundError, netrc.NetrcParseError, PermissionError):
        pass
    return None


def require_credentials(env: Mapping[str, str] = os.environ, netrc_path: Path | None = None) -> str:
    source = credential_source(env, netrc_path)
    if source is None:
        raise CredentialsError(HELP)
    return source


def earthdata_opener(source: str) -> Opener:
    import earthaccess

    logging.getLogger("earthaccess").setLevel(logging.WARNING)
    auth = earthaccess.login(strategy=source, persist=False)
    if not auth or not getattr(auth, "authenticated", False):
        raise CredentialsError("Earthdata rechazó las credenciales configuradas. " + HELP)
    fs = earthaccess.get_fsspec_https_session()
    return lambda url: fs.open(url, mode="rb", block_size=4 * 1024 * 1024, cache_type="blockcache")


def _cache_path(cache_dir: Path, product: Product, grid: Grid, pol: str) -> Path:
    key = hashlib.sha1(f"{grid.crs}{grid.bounds}{pol}".encode()).hexdigest()[:10]
    return cache_dir / f"{product.id}.{key}.npz"


def fetch_subsets(
    products: list[Product], grid: Grid, cache_dir: Path, opener: Opener, pol: str = "HH"
) -> list[GunwSubset]:
    out = []
    for n, product in enumerate(products, 1):
        path = _cache_path(cache_dir, product, grid, pol)
        if path.is_file():
            log.debug("caché: %s", product.id)
            out.append(GunwSubset.load(path))
            continue
        log.info("Descargando recorte %d/%d: %s", n, len(products), product.id)
        with opener(product.url) as fobj, h5py.File(fobj, "r") as f:
            sub = read_subset(f, grid, pol=pol)
        sub.save(path)
        out.append(sub)
    return out
