from datetime import date

import numpy as np

from nisar_pipeline.opera import (
    Item,
    build_history,
    merge_with_nisar,
    overlap_rates,
    parse_items,
    select_items,
)


def _name(ref, sec, prod="20250413", frame=46291):
    return f"OPERA_L3_DISP-S1_IW_F{frame}_VV_{ref}T134440Z_{sec}T134402Z_v1.0_{prod}T101530Z"


def test_parse_items_filters_frame_and_keeps_latest_version():
    items = parse_items(
        [_name("20160702", "20160726"), _name("20160702", "20160726", "20260101") + ".nc",
         _name("20160702", "20160807", frame=1)],
        46291,
    )
    assert len(items) == 1
    assert items[0].version == "20260101" and items[0].sec == "2016-07-26"
    assert not items[0].id.endswith(".nc")


def test_select_items_keeps_chain_links_and_last():
    items = [
        Item("a", "2020-01-01", "2020-01-13", "1"),
        Item("b", "2020-01-01", "2020-02-06", "1"),   # eslabón: es la siguiente referencia
        Item("c", "2020-02-06", "2020-02-18", "1"),
        Item("d", "2020-02-06", "2020-07-01", "1"),
        Item("e", "2020-02-06", "2020-07-13", "1"),
    ]
    got = [i.id for i in select_items(items, 75)]
    assert got == ["a", "b", "d", "e"]


def test_build_history_chains_reference_groups():
    h, w = 40, 40
    from nisar_pipeline.grid import make_grid

    grid = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 40)
    h, w = grid.height, grid.width
    x = grid.west + (np.arange(w) + 0.5) * grid.cell
    y = grid.north - (np.arange(h) + 0.5) * grid.cell
    sinking = np.zeros((h, w), np.float32)
    sinking[20:30, 20:30] = -1.0

    def sub(cm):
        return {"disp": sinking * cm, "x": x, "y": y, "epsg": 32611}

    items = [
        Item("a", "2020-01-01", "2020-07-01", "1"),
        Item("b", "2020-07-01", "2021-01-01", "1"),   # nuevo grupo: mide desde 2020-07-01
    ]
    ref = np.zeros((h, w), bool)
    ref[:8, :8] = True
    stable = np.ones((h, w), bool)
    stable[15:35, 15:35] = False
    cube, dates = build_history(items, [sub(5), sub(5)], grid, ref, stable)
    assert dates == [date(2020, 1, 1), date(2020, 7, 1), date(2021, 1, 1)]
    assert np.nanmin(cube[-1]) < -9  # los dos grupos se suman
    assert np.nanmax(np.abs(cube[0])) == 0


def test_merge_continues_from_last_history_value():
    hist = np.array([[[0.0]], [[-5.0]], [[-10.0]], [[-11.0]]], np.float32)
    hd = [date(2020, 1, 1), date(2021, 1, 1), date(2025, 10, 1), date(2026, 1, 1)]
    nisar = np.array([[[0.0]], [[-1.0]], [[-2.0]]], np.float32)
    nd = [date(2025, 10, 23), date(2026, 1, 1), date(2026, 6, 1)]
    cube, dates, junction = merge_with_nisar(hist, hd, nisar, nd)
    assert junction == date(2025, 10, 1)
    assert cube[:, 0, 0].tolist() == [0, -5, -10, -11, -12]
    assert dates == [hd[0], hd[1], hd[2], nd[1], nd[2]]


def test_overlap_rates_compare_same_period():
    hd = [date(2024, 1, 1), date(2025, 1, 1), date(2026, 1, 1)]
    nd = [date(2025, 1, 1), date(2026, 1, 1), date(2027, 1, 1)]
    hist = np.array([[[0.0]], [[-5.0]], [[-10.0]]], np.float32)
    nisar = np.array([[[0.0]], [[-4.0]], [[-8.0]]], np.float32)
    a, b = overlap_rates(hist, hd, nisar, nd)
    assert a[0, 0] == np.float32(a[0, 0])
    assert abs(a[0, 0] + 5) < 0.1 and abs(b[0, 0] + 4) < 0.1
