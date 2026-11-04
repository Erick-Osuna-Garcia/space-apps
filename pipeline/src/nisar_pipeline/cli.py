from __future__ import annotations

import argparse
import logging
import sys

from .build import plan_synthetic, run
from .config import load_config

log = logging.getLogger("nisar_pipeline")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nisar-pipeline",
        description="Genera assets web (terreno + capas NISAR) para el explorador isométrico.",
    )
    parser.add_argument("--config", default="regions.yaml", help="Ruta a regions.yaml")
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="Genera capas sintéticas (desarrollo) en lugar de descargar NISAR",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("asf_search").setLevel(logging.WARNING)
    cfg = load_config(args.config)
    if args.synthetic:
        planner = plan_synthetic
    else:
        from .nisar import plan_nisar

        planner = plan_nisar
    try:
        path = run(cfg, planner)
    except Exception as exc:  # noqa: BLE001 - mensaje claro en CLI
        log.error("%s", exc)
        return 1
    log.info("Manifiesto escrito en %s", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
