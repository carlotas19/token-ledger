#!/usr/bin/env python3
"""Run Token Ledger against every enabled Neon AI Gateway text model."""

from __future__ import annotations

import concurrent.futures
import json
import os
import re
import statistics
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WORKLOAD_PATH = ROOT / "benchmark" / "workload.json"
CHECKPOINT_PATH = ROOT / "benchmark" / "results" / "checkpoint.json"
RAW_PATH = ROOT / "benchmark" / "results" / "latest.json"
SUMMARY_PATH = ROOT / "src" / "data" / "latest-benchmark.json"
PRICING_SOURCE = "https://neon.com/docs/ai-gateway/models#available-models"

PROJECT_ID = "silent-violet-94567844"
PARENT_BRANCH = "br-young-snow-ax2vm8ck"
MAX_OUTPUT_TOKENS = 2048
MAX_WORKERS = 8
RESPONSES_ONLY = {"gpt-5-3-codex", "gpt-5-5-pro"}
WRITE_LOCK = threading.Lock()

SYSTEM_PROMPT = """You are a support agent for a developer platform.
Read the customer message, account context, and policy notes.
Return ONLY valid JSON with this shape:
{
  "classification": "billing|access|feature|security|refund|other",
  "action": "reply_only|reset_password|issue_credit|deny_request|escalate_security",
  "escalate": true|false,
  "customer_reply": "concise customer-facing reply"
}
Rules:
- Never invent account facts not present in the context.
- Escalate only when the policy notes require escalation.
- Follow refund and credit policy strictly.
- Keep customer_reply under 120 words."""


def load_env() -> None:
    for env_path in (ROOT / ".env.local", ROOT / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value.strip().strip('"'))


def request_json(
    url: str,
    *,
    token: str | None = None,
    body: dict[str, Any] | None = None,
    retries: int = 7,
) -> dict[str, Any]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            message = error.read().decode(errors="replace")
            if error.code not in {429, 500, 502, 503, 504} or attempt == retries - 1:
                raise RuntimeError(f"HTTP {error.code} from {url}: {message}") from error
            retry_after = float(error.headers.get("Retry-After", 0) or 0)
            time.sleep(max(retry_after, min(60, 2 ** attempt)))
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == retries - 1:
                raise RuntimeError(f"Request failed for {url}: {error}") from error
            time.sleep(min(60, 2 ** attempt))
    raise AssertionError("unreachable")


def gateway_host(branch_id: str) -> str:
    main_host = os.environ["NEON_AI_GATEWAY_BASE_URL"].rstrip("/")
    match = re.match(r"https://[^.]+-api\.ai\.(.+)", main_host)
    if not match:
        raise RuntimeError(f"Unexpected AI Gateway host: {main_host}")
    return f"https://{branch_id}-api.ai.{match.group(1)}"


def run_neon(*args: str) -> Any:
    completed = subprocess.run(
        ["neon", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def ensure_model_branches(model_ids: list[str]) -> dict[str, dict[str, str]]:
    branches = run_neon("branches", "list", "--project-id", PROJECT_ID, "-o", "json")
    by_name = {branch["name"]: branch for branch in branches}
    mapping: dict[str, dict[str, str]] = {}

    for model_id in model_ids:
        safe_model = re.sub(r"[^a-z0-9-]+", "-", model_id.lower()).strip("-")
        name = f"model-{safe_model}"[:63]
        branch = by_name.get(name)
        if branch is None:
            print(f"Creating Neon branch {name}")
            created = run_neon(
                "branches",
                "create",
                "--project-id",
                PROJECT_ID,
                "--parent",
                PARENT_BRANCH,
                "--name",
                name,
                "--no-compute",
                "-o",
                "json",
            )
            branch = created.get("branch", created)
            by_name[name] = branch
        mapping[model_id] = {
            "branchId": branch["id"],
            "branchName": branch["name"],
            "gatewayBaseUrl": gateway_host(branch["id"]),
        }
    return mapping


def user_prompt(ticket: dict[str, Any]) -> str:
    return f"""Ticket: {ticket["scenario"]}

Customer message:
{ticket["customerMessage"]}

Account context:
{ticket["accountContext"]}

Policy notes:
{ticket["policyNotes"]}"""


def content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "\n".join(
        str(block.get("text", ""))
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    ).strip()


def response_text(payload: dict[str, Any], responses_api: bool) -> str:
    if not responses_api:
        return content_text(payload.get("choices", [{}])[0].get("message", {}).get("content"))
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    texts = []
    for item in payload.get("output", []):
        for block in item.get("content", []):
            if block.get("type") in {"output_text", "text"}:
                texts.append(str(block.get("text", "")))
    return "\n".join(texts).strip()


def parse_output(raw: str) -> dict[str, Any] | None:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.I)
    candidate = fenced.group(1).strip() if fenced else raw.strip()
    if not candidate.startswith("{"):
        start, end = candidate.find("{"), candidate.rfind("}")
        if start >= 0 and end > start:
            candidate = candidate[start : end + 1]
    try:
        parsed = json.loads(candidate)
        return {
            "classification": str(parsed.get("classification", "")),
            "action": str(parsed.get("action", "")),
            "escalate": bool(parsed.get("escalate", False)),
            "customerReply": str(parsed.get("customer_reply", parsed.get("customerReply", ""))),
        }
    except (json.JSONDecodeError, AttributeError):
        return None


def grade(ticket: dict[str, Any], parsed: dict[str, Any] | None) -> dict[str, Any]:
    if parsed is None:
        return {
            "completed": False,
            "checks": [{"id": "valid_json", "passed": False}],
        }

    expected = ticket["expected"]
    reply = parsed["customerReply"]
    lower_reply = reply.lower()
    words = reply.split()
    checks = [
        {"id": "valid_json", "passed": True},
        {
            "id": "classification",
            "passed": parsed["classification"] == expected["classification"],
        },
        {
            "id": "action",
            "passed": parsed["action"] in expected["allowedActions"],
        },
        {
            "id": "escalation",
            "passed": parsed["escalate"] == expected["escalate"],
        },
        {"id": "reply_length", "passed": 0 < len(words) <= 120},
        {
            "id": "required_terms",
            "passed": all(term.lower() in lower_reply for term in expected["mustMention"]),
        },
        {
            "id": "forbidden_terms",
            "passed": all(term.lower() not in lower_reply for term in expected["mustNotMention"]),
        },
    ]
    return {"completed": all(check["passed"] for check in checks), "checks": checks}


def usage_from(payload: dict[str, Any], responses_api: bool) -> dict[str, int]:
    usage = payload.get("usage") or {}
    if responses_api:
        input_tokens = int(usage.get("input_tokens", 0))
        output_tokens = int(usage.get("output_tokens", 0))
        details = usage.get("output_tokens_details") or {}
    else:
        input_tokens = int(usage.get("prompt_tokens", 0))
        output_tokens = int(usage.get("completion_tokens", 0))
        details = usage.get("completion_tokens_details") or {}
    return {
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "reasoningTokens": int(details.get("reasoning_tokens", 0)),
        "totalTokens": int(usage.get("total_tokens", input_tokens + output_tokens)),
    }


def estimated_cost(usage: dict[str, int], model: dict[str, Any]) -> float | None:
    cost = model.get("cost")
    if not cost or cost.get("input") is None or cost.get("output") is None:
        return None
    priced_output_tokens = max(
        usage["outputTokens"],
        usage["totalTokens"] - usage["inputTokens"],
    )
    return (
        usage["inputTokens"] * float(cost["input"])
        + priced_output_tokens * float(cost["output"])
    ) / 1_000_000


def run_ticket(
    model: dict[str, Any],
    branch: dict[str, str],
    ticket: dict[str, Any],
    token: str,
) -> dict[str, Any]:
    started = time.monotonic()
    responses_api = model["id"] in RESPONSES_ONLY
    prompt = user_prompt(ticket)
    if responses_api:
        url = f'{branch["gatewayBaseUrl"]}/openai/v1/responses'
        body = {
            "model": model["id"],
            "instructions": SYSTEM_PROMPT,
            "input": prompt,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
        }
    else:
        url = f'{branch["gatewayBaseUrl"]}/v1/chat/completions'
        body = {
            "model": model["id"],
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": MAX_OUTPUT_TOKENS,
        }

    try:
        payload = request_json(url, token=token, body=body)
        raw = response_text(payload, responses_api)
        parsed = parse_output(raw)
        result_grade = grade(ticket, parsed)
        usage = usage_from(payload, responses_api)
        error = None
    except Exception as exc:  # Keep failed calls in the denominator.
        raw = ""
        parsed = None
        result_grade = {"completed": False, "checks": [{"id": "request", "passed": False}]}
        usage = {"inputTokens": 0, "outputTokens": 0, "reasoningTokens": 0, "totalTokens": 0}
        error = str(exc)

    return {
        "id": str(uuid.uuid4()),
        "modelId": model["id"],
        "branchId": branch["branchId"],
        "branchName": branch["branchName"],
        "ticketId": ticket["id"],
        "latencyMs": round((time.monotonic() - started) * 1000),
        "usage": usage,
        "estimatedCostUsd": estimated_cost(usage, model),
        "completed": result_grade["completed"],
        "checks": result_grade["checks"],
        "parsedResponse": parsed,
        "rawResponse": raw,
        "error": error,
    }


def aggregate(model: dict[str, Any], branch: dict[str, str], runs: list[dict[str, Any]]) -> dict[str, Any]:
    completed = [run for run in runs if run["completed"]]
    totals = {
        key: sum(run["usage"][key] for run in runs)
        for key in ("inputTokens", "outputTokens", "reasoningTokens", "totalTokens")
    }
    priced = [run["estimatedCostUsd"] for run in runs if run["estimatedCostUsd"] is not None]
    total_cost = sum(priced) if len(priced) == len(runs) else None
    success_count = len(completed)
    output_tokens = [run["usage"]["outputTokens"] for run in runs]
    failed_checks = Counter(
        check["id"]
        for run in runs
        for check in run["checks"]
        if not check["passed"]
    )
    return {
        "modelId": model["id"],
        "modelName": model["name"],
        "provider": model["provider"],
        "openWeights": bool(model.get("open_weights")),
        "branchId": branch["branchId"],
        "branchName": branch["branchName"],
        "attempts": len(runs),
        "successes": success_count,
        "passRate": success_count / len(runs) if runs else 0,
        **totals,
        "pricedOutputTokens": max(
            totals["outputTokens"],
            totals["totalTokens"] - totals["inputTokens"],
        ),
        "totalCostUsd": total_cost,
        "tokensPerSuccess": totals["totalTokens"] / success_count if success_count else None,
        "costPerSuccessUsd": total_cost / success_count if total_cost is not None and success_count else None,
        "failedChecks": dict(failed_checks.most_common()),
        "medianOutputTokens": statistics.median(output_tokens) if output_tokens else 0,
        "maxOutputTokensUsed": max(output_tokens, default=0),
        "outputCapHits": sum(tokens >= MAX_OUTPUT_TOKENS for tokens in output_tokens),
        "medianVisibleWords": statistics.median(
            len(run["rawResponse"].split()) for run in runs
        ) if runs else 0,
    }


def refresh_aggregate_price(summary: dict[str, Any], model: dict[str, Any]) -> None:
    cost = model.get("cost")
    if not cost or cost.get("input") is None or cost.get("output") is None:
        summary["totalCostUsd"] = None
        summary["costPerSuccessUsd"] = None
        return
    priced_output_tokens = max(
        summary["outputTokens"],
        summary["totalTokens"] - summary["inputTokens"],
    )
    summary["pricedOutputTokens"] = priced_output_tokens
    total_cost = (
        summary["inputTokens"] * float(cost["input"])
        + priced_output_tokens * float(cost["output"])
    ) / 1_000_000
    summary["totalCostUsd"] = total_cost
    summary["costPerSuccessUsd"] = (
        total_cost / summary["successes"] if summary["successes"] else None
    )


def save_checkpoint(state: dict[str, Any]) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_PATH.write_text(json.dumps(state, indent=2) + "\n")


def run_model(
    model: dict[str, Any],
    branch: dict[str, str],
    workload: list[dict[str, Any]],
    token: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    print(f'Running {model["id"]} on {branch["branchName"]}')
    runs = [run_ticket(model, branch, ticket, token) for ticket in workload]
    summary = aggregate(model, branch, runs)
    print(
        f'Finished {model["id"]}: {summary["successes"]}/{summary["attempts"]} complete, '
        f'{summary["totalTokens"]:,} tokens'
    )
    return summary, runs


def main() -> None:
    load_env()
    token = os.environ["NEON_AI_GATEWAY_TOKEN"]
    workload = json.loads(WORKLOAD_PATH.read_text())
    if len(workload) != 100:
        raise RuntimeError(f"Expected 100 workload tickets, found {len(workload)}")

    model_payload = request_json("https://neon.com/models.json")
    catalog = model_payload["neon"]["models"]
    enabled_payload = request_json(
        f'{os.environ["NEON_AI_GATEWAY_BASE_URL"].rstrip("/")}/v1/models',
        token=token,
    )
    enabled_ids = {
        item["id"].removeprefix("databricks-")
        for item in enabled_payload["data"]
        if item.get("enabled", True)
    }
    models = [
        model
        for model in catalog.values()
        if model["id"] in enabled_ids
        and model.get("modalities", {}).get("output") == ["text"]
    ]
    models.sort(key=lambda model: (model["provider"], model["id"]))
    print(f"Benchmarking {len(models)} enabled text models")

    branches = ensure_model_branches([model["id"] for model in models])
    state = {
        "benchmark": {
            "id": str(uuid.uuid4()),
            "name": "Token Ledger 100-ticket support benchmark",
            "status": "running",
            "ticketCount": len(workload),
            "modelCount": len(models),
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": None,
            "catalogSnapshotAt": datetime.now(timezone.utc).isoformat(),
            "pricingSnapshotAt": datetime.now(timezone.utc).isoformat(),
            "pricingSource": PRICING_SOURCE,
            "projectId": PROJECT_ID,
            "parentBranchId": PARENT_BRANCH,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "systemPrompt": SYSTEM_PROMPT,
        },
        "models": [],
        "runs": [],
    }
    if CHECKPOINT_PATH.exists():
        previous = json.loads(CHECKPOINT_PATH.read_text())
        if previous.get("benchmark", {}).get("ticketCount") == len(workload):
            state = previous

    completed_ids = {model["modelId"] for model in state["models"]}
    pending = [model for model in models if model["id"] not in completed_ids]

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(run_model, model, branches[model["id"]], workload, token): model
            for model in pending
        }
        for future in concurrent.futures.as_completed(futures):
            summary, runs = future.result()
            with WRITE_LOCK:
                state["models"].append(summary)
                state["runs"].extend(runs)
                save_checkpoint(state)

    state["benchmark"]["status"] = "completed"
    state["benchmark"]["completedAt"] = datetime.now(timezone.utc).isoformat()
    state["benchmark"]["pricingSnapshotAt"] = datetime.now(timezone.utc).isoformat()
    state["benchmark"]["pricingSource"] = PRICING_SOURCE
    for summary in state["models"]:
        refresh_aggregate_price(summary, catalog[summary["modelId"]])
    state["models"].sort(
        key=lambda model: (
            model["costPerSuccessUsd"] is None,
            model["costPerSuccessUsd"] or float("inf"),
        )
    )
    RAW_PATH.write_text(json.dumps(state, indent=2) + "\n")
    summary = {**state["benchmark"], "aggregates": state["models"]}
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n")
    save_checkpoint(state)
    print(f"Wrote raw results to {RAW_PATH}")
    print(f"Wrote frontend summary to {SUMMARY_PATH}")


if __name__ == "__main__":
    main()
