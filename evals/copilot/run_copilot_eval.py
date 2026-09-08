"""Run the live Copilot eval against local Ollama.

Usage (from repo root, Mongo + Ollama running):

    COPILOT_EVAL=1 PYTHONPATH=.:backend backend/.venv/bin/python evals/copilot/run_copilot_eval.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from evals.copilot.copilot_eval import load_cases, ollama_available, run_live_cases

RESULTS_PATH = Path(__file__).resolve().parent / "copilot_results.json"


def main() -> int:
    dataset = load_cases()
    if not ollama_available():
        print("Ollama is not reachable at COPILOT_BASE_URL (default localhost:11434).")
        return 2

    rows = asyncio.run(run_live_cases(dataset["cases"]))
    passed = sum(1 for row in rows if row["passed"])
    total = len(rows)
    report = {
        "run_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "model": os.getenv("COPILOT_MODEL", "qwen2.5:7b"),
        "prompt_version": dataset.get("prompt_version"),
        "passed": passed,
        "total": total,
        "accuracy": round(passed / total, 3) if total else 0.0,
        "failed_ids": [row["id"] for row in rows if not row["passed"]],
        "cases": rows,
    }
    RESULTS_PATH.write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))
    print(f"Wrote {RESULTS_PATH}", file=sys.stderr)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
