#!/usr/bin/env python3
"""Reprice saved benchmark token usage from the Neon AI Gateway catalog."""

from __future__ import annotations

import json
import statistics
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SUMMARY_PATH = ROOT / "src" / "data" / "latest-benchmark.json"
RAW_PATH = ROOT / "benchmark" / "results" / "latest.json"
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
    runs_by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if RAW_PATH.exists():
        raw = json.loads(RAW_PATH.read_text())
        for run in raw.get("runs", []):
            runs_by_model[run["modelId"]].append(run)

    for model in summary["aggregates"]:
        catalog_model = catalog.get(model["modelId"])
        cost = catalog_model.get("cost") if catalog_model else None
        if not cost or cost.get("input") is None or cost.get("output") is None:
            model["totalCostUsd"] = None
            model["costPerSuccessUsd"] = None
            continue

        priced_output_tokens = max(
            model["outputTokens"],
            model["totalTokens"] - model["inputTokens"],
        )
        model["pricedOutputTokens"] = priced_output_tokens
        total_cost = (
            model["inputTokens"] * float(cost["input"])
            + priced_output_tokens * float(cost["output"])
        ) / 1_000_000
        successes = int(model["successes"])
        model["totalCostUsd"] = total_cost
        model["costPerSuccessUsd"] = total_cost / successes if successes else None

        runs = runs_by_model[model["modelId"]]
        if runs:
            failed_checks = Counter(
                check["id"]
                for run in runs
                for check in run["checks"]
                if not check["passed"]
            )
            output_tokens = [run["usage"]["outputTokens"] for run in runs]
            model["failedChecks"] = dict(failed_checks.most_common())
            model["medianOutputTokens"] = statistics.median(output_tokens)
            model["maxOutputTokensUsed"] = max(output_tokens)
            model["outputCapHits"] = sum(
                tokens >= summary["maxOutputTokens"] for tokens in output_tokens
            )
            model["medianVisibleWords"] = statistics.median(
                len(run["rawResponse"].split()) for run in runs
            )

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
