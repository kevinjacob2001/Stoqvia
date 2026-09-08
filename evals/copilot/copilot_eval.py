"""Score Stoqvia Copilot tool selection against a frozen case file."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import URLError
from urllib.request import urlopen

from data.seed.loader import oid_from_key

CASES_PATH = Path(__file__).resolve().parent / "copilot_cases.json"
AUTH_STORE_KEY = "adelaide_cbd"


def load_cases(path: Path = CASES_PATH) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def auth_store_id() -> str:
    return str(oid_from_key(AUTH_STORE_KEY))


def product_id_for_sku(sku: str) -> str:
    return str(oid_from_key(sku))


def resolve_selected_product_id(case: Dict[str, Any]) -> Optional[str]:
    sku = case.get("use_selected_product_sku")
    if sku:
        return product_id_for_sku(str(sku))
    selected = case.get("selected_product_id")
    return str(selected) if selected else None


def score_selection(
    case: Dict[str, Any],
    selection: Any,
    authenticated_store_id: str,
) -> Tuple[bool, str]:
    expected_status = case["expect_status"]
    if selection.status != expected_status:
        return (
            False,
            f"status {selection.status!r} != {expected_status!r}",
        )

    expected_tool = case.get("expect_tool")
    if expected_tool and selection.tool_name != expected_tool:
        return (
            False,
            f"tool {selection.tool_name!r} != {expected_tool!r}",
        )

    if expected_status != "TOOL_SELECTED":
        return True, "ok"

    if case.get("expect_store_locked"):
        actual_store = selection.tool_args.get("store_id")
        if actual_store != authenticated_store_id:
            return (
                False,
                f"store_id {actual_store!r} != authenticated {authenticated_store_id!r}",
            )

    expected_sku = case.get("expect_sku")
    if expected_sku:
        expected_product_id = product_id_for_sku(str(expected_sku))
        actual_product_id = selection.tool_args.get("product_id")
        if actual_product_id != expected_product_id:
            return (
                False,
                f"product_id {actual_product_id!r} != {expected_product_id!r} for {expected_sku}",
            )

    expected_surplus = case.get("expect_min_safe_surplus")
    if expected_surplus is not None:
        actual_surplus = selection.tool_args.get("min_safe_surplus")
        if actual_surplus != expected_surplus:
            return (
                False,
                f"min_safe_surplus {actual_surplus!r} != {expected_surplus!r}",
            )

    return True, "ok"


def ollama_available(base_url: Optional[str] = None) -> bool:
    url = (base_url or os.getenv("COPILOT_BASE_URL", "http://localhost:11434")).rstrip(
        "/"
    )
    try:
        with urlopen(f"{url}/api/tags", timeout=2) as response:
            return 200 <= response.status < 300
    except (URLError, TimeoutError, OSError):
        return False


def live_eval_enabled() -> bool:
    return os.getenv("COPILOT_EVAL", "").lower() in {"1", "true", "yes"}


async def run_live_cases(
    cases: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    from app.services.copilot_services import choose_copilot_tool

    store_id = auth_store_id()
    dataset = cases if cases is not None else load_cases()["cases"]
    rows: List[Dict[str, Any]] = []

    for case in dataset:
        selection = await choose_copilot_tool(
            message=case["message"],
            authenticated_store_id=store_id,
            selected_product_id=resolve_selected_product_id(case),
        )
        passed, reason = score_selection(case, selection, store_id)
        rows.append(
            {
                "id": case["id"],
                "category": case.get("category"),
                "passed": passed,
                "reason": reason,
                "status": selection.status,
                "tool_name": selection.tool_name,
                "tool_args": selection.tool_args,
            }
        )

    return rows
