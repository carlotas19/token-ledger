#!/usr/bin/env python3
"""Reprice saved benchmark token usage from the Neon AI Gateway catalog."""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SUMMARY_PATH = ROOT / "src" / "data" / "latest-benchmark.json"
PRICING_SOURCE = "https://neon.com/models.json"
PRICING_DOCS = "https://neon.com/docs/ai-gateway/models#available-models"


def fetch_catalog() -> dict[str, Any]:
    request = urllib.request.Request(
        PRICING_SOURCE,
        headers={"Accept": "application/json", "User-Agent": "tokenomics-benchmark"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read())
    return payload["neon"]["models"]


def main() -> None:
    summary = json.loads(SUMMARY_PATH.read_text())
    catalog = fetch_catalog()

    for model in summary["aggregates"]:
        catalog_model = catalog.get(model["modelId"])
        cost = catalog_model.get("cost") if catalog_model else None
        if not cost or cost.get("input") is None or cost.get("output") is None:
            model["totalCostUsd"] = None
            model["costPerSuccessUsd"] = None
            continue

        total_cost = (
            model["inputTokens"] * float(cost["input"])
            + model["outputTokens"] * float(cost["output"])
        ) / 1_000_000
        successes = int(model["successes"])
        model["totalCostUsd"] = total_cost
        model["costPerSuccessUsd"] = total_cost / successes if successes else None

    summary["pricingSnapshotAt"] = datetime.now(timezone.utc).isoformat()
    summary["pricingSource"] = PRICING_DOCS
    summary["aggregates"].sort(
        key=lambda model: (
            model["costPerSuccessUsd"] is None,
            model["costPerSuccessUsd"] or float("inf"),
        )
    )
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n")
    print(
        f"Repriced {len(summary['aggregates'])} models from {PRICING_DOCS} "
        f"and updated {SUMMARY_PATH}"
    )


if __name__ == "__main__":
    main()
