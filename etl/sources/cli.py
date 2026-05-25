"""Command-line helper to inspect state connectors."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict

from . import (
    BahiaSSPConnector,
    MinasGeraisSegurancaConnector,
    RioDeJaneiroISPConnector,
    SaoPauloSSPConnector,
)


CONNECTORS = {
    "ba": BahiaSSPConnector,
    "mg": MinasGeraisSegurancaConnector,
    "rj": RioDeJaneiroISPConnector,
    "sp": SaoPauloSSPConnector,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect state source connectors")
    parser.add_argument("state", choices=sorted(CONNECTORS))
    parser.add_argument("--discover", action="store_true", help="Print discovered resources as JSON")
    args = parser.parse_args()

    connector = CONNECTORS[args.state]()
    if args.discover:
        print(json.dumps([asdict(resource) for resource in connector.discover()], ensure_ascii=False, indent=2))
        return 0

    parser.error("choose an action, for example --discover")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

