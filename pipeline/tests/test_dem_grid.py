import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from nisar_pipeline.dem import copernicus_tile_url, load_dem, tiles_for_bbox, tiles_for_grid
from nisar_pipeline.grid import make_grid

BBOX = (-115.65, 32.20, -115.00, 32.75)


def test_grid_is_square_cells_with_max_side():
    g = make_grid(BBOX, "EPSG:32611", 512)
    assert max(g.width, g.height) == 512
    min_x, min_y, max_x, max_y = g.bounds
    assert max_x - min_x == pytest.approx(g.width * g.cell)
    assert max_y - min_y == pytest.approx(g.height * g.cell)
    # ~60 km de lado
    assert 55_000 < g.width * g.cell < 70_000


def test_lonlat_roundtrip_inside_grid():
    g = make_grid(BBOX, "EPSG:32611", 512)
    col, row = g.lonlat_to_colrow(-115.24, 32.40)
    assert 0 < col < g.width and 0 < row < g.height
    corners = g.corner_lonlat()
    assert corners["nw"][1] > corners["sw"][1]
    assert corners["ne"][0] > corners["nw"][0]


def test_coarsened_keeps_extent():
    g = make_grid(BBOX, "EPSG:32611", 512)
    c = g.coarsened(2)
    assert c.width == 256
    assert c.width * c.cell == pytest.approx(g.width * g.cell)


def test_tile_naming_and_cover():
    assert tiles_for_bbox(BBOX) == [(32, -116)]
    # la envolvente UTM se sale ligeramente al este de -115°
    assert (32, -116) in tiles_for_grid(make_grid(BBOX, "EPSG:32611", 64))
    assert copernicus_tile_url(32, -116).endswith(
        "Copernicus_DSM_COG_10_N32_00_W116_00_DEM/Copernicus_DSM_COG_10_N32_00_W116_00_DEM.tif"
    )


def test_load_dem_aligns_to_grid(tmp_path):
    # Tesela falsa de 3°x1° en WGS84 con un gradiente de alturas: 0 m al oeste, 1000 m al este.
    n = 120
    data = np.tile(np.linspace(0, 1000, 3 * n, dtype=np.float32), (n, 1))
    path = tmp_path / "tile.tif"
    with rasterio.open(
        path, "w", driver="GTiff", width=3 * n, height=n, count=1, dtype="float32",
        crs="EPSG:4326", transform=from_origin(-117, 33, 1 / n, 1 / n),
    ) as dst:
        dst.write(data, 1)

    g = make_grid(BBOX, "EPSG:32611", 64)
    missing = str(tmp_path / "no-existe.tif")
    urls = {(32, -116): str(path), (31, -116): missing}
    dem = load_dem(g, tile_url=lambda la, lo: urls[(la, lo)], tiles=urls.keys())

    assert dem.shape == (g.height, g.width)
    assert np.isfinite(dem).all()
    assert (dem > 0).all()
    # el gradiente oeste->este se conserva (~0.65° de 3° -> ~215 m)
    assert dem[:, -1].mean() > dem[:, 0].mean() + 150


def test_load_dem_fails_without_tiles(tmp_path):
    g = make_grid(BBOX, "EPSG:32611", 16)
    with pytest.raises(RuntimeError, match="ninguna tesela"):
        load_dem(g, tile_url=lambda la, lo: str(tmp_path / "x.tif"), tiles=[(32, -116)])
