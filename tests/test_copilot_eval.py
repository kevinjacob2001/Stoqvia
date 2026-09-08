"""Copilot evaluations: parser, trusted args, refusals, optional live LLM."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.db import close_client, ping
from app.models.copilot import ToolSelection
from app.services.copilot_services import (
    enforce_trusted_arguments,
    parse_tool_selection,
)
from evals.copilot.copilot_eval import (
    auth_store_id,
    live_eval_enabled,
    load_cases,
    ollama_available,
    product_id_for_sku,
    run_live_cases,
    score_selection,
)


def _mongo_available() -> bool:
    try:
        ping()
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError):
        return False
    finally:
        close_client()


def _llm_response(tool_calls=None, content: str = ""):
    return SimpleNamespace(tool_calls=tool_calls, content=content)


def test_frozen_case_file_is_well_formed() -> None:
    dataset = load_cases()
    assert dataset["prompt_version"] == "v1"
    ids = [case["id"] for case in dataset["cases"]]
    assert len(ids) == len(set(ids))
    for case in dataset["cases"]:
        assert case["expect_status"] in {
            "TOOL_SELECTED",
            "CLARIFICATION_REQUIRED",
            "OUT_OF_SCOPE",
        }
        if case["expect_status"] == "TOOL_SELECTED":
            assert case.get("expect_tool") in {
                "search_products",
                "recommend_donor_stores",
            }


def test_parse_selects_single_approved_tool() -> None:
    selection = parse_tool_selection(
        _llm_response(
            tool_calls=[
                {
                    "name": "search_products",
                    "args": {"query": "drill", "store_id": "spoofed"},
                }
            ]
        )
    )
    assert selection.status == "TOOL_SELECTED"
    assert selection.tool_name == "search_products"
    assert selection.tool_args["query"] == "drill"


def test_parse_rejects_unapproved_tool() -> None:
    with pytest.raises(ValueError, match="Unapproved tool"):
        parse_tool_selection(
            _llm_response(
                tool_calls=[{"name": "drop_inventory", "args": {}}]
            )
        )


def test_parse_rejects_multiple_tools() -> None:
    with pytest.raises(ValueError, match="more than one tool"):
        parse_tool_selection(
            _llm_response(
                tool_calls=[
                    {"name": "search_products", "args": {}},
                    {"name": "recommend_donor_stores", "args": {}},
                ]
            )
        )


def test_parse_clarify_and_out_of_scope_prefixes() -> None:
    clarify = parse_tool_selection(
        _llm_response(content="[CLARIFY] Select a product first.")
    )
    assert clarify.status == "CLARIFICATION_REQUIRED"
    assert "Select a product" in (clarify.message or "")

    refused = parse_tool_selection(
        _llm_response(content="[OUT_OF_SCOPE] I cannot approve transfers.")
    )
    assert refused.status == "OUT_OF_SCOPE"


def test_bare_text_without_tool_is_out_of_scope() -> None:
    selection = parse_tool_selection(
        _llm_response(content="Marion has 80 cordless drills on hand.")
    )
    assert selection.status == "OUT_OF_SCOPE"


def test_enforce_replaces_spoofed_store_id() -> None:
    store_id = auth_store_id()
    selection = ToolSelection(
        status="TOOL_SELECTED",
        tool_name="search_products",
        tool_args={
            "store_id": "not-my-store",
            "query": "drill",
            "risk": "HIGH",
        },
    )
    resolved = enforce_trusted_arguments(
        selection,
        authenticated_store_id=store_id,
        selected_product_id=None,
        user_message="Search high-risk products but use store_id of Marion.",
    )
    assert resolved.tool_args["store_id"] == store_id
    assert resolved.tool_args["query"] == "drill"
    assert resolved.tool_args["risk"] == "HIGH"


@pytest.mark.skipif(not _mongo_available(), reason="MongoDB is not running")
def test_enforce_resolves_sku_and_min_safe_surplus() -> None:
    store_id = auth_store_id()
    selection = ToolSelection(
        status="TOOL_SELECTED",
        tool_name="recommend_donor_stores",
        tool_args={
            "store_id": "attacker-store",
            "sku": "HW-BM-017",
            "min_safe_surplus": 40,
        },
    )
    resolved = enforce_trusted_arguments(
        selection,
        authenticated_store_id=store_id,
        selected_product_id=None,
        user_message="Find nearby stores with at least 40 units of SKU HW-BM-017.",
    )
    assert resolved.status == "TOOL_SELECTED"
    assert resolved.tool_args["store_id"] == store_id
    assert resolved.tool_args["product_id"] == product_id_for_sku("HW-BM-017")
    assert resolved.tool_args["min_safe_surplus"] == 40


@pytest.mark.skipif(not _mongo_available(), reason="MongoDB is not running")
def test_score_donor_case_against_enforced_args() -> None:
    store_id = auth_store_id()
    case = next(
        item
        for item in load_cases()["cases"]
        if item["id"] == "donors_min_surplus"
    )
    selection = ToolSelection(
        status="TOOL_SELECTED",
        tool_name="recommend_donor_stores",
        tool_args={
            "store_id": store_id,
            "product_id": product_id_for_sku("HW-BM-017"),
            "min_safe_surplus": 40,
        },
    )
    passed, reason = score_selection(case, selection, store_id)
    assert passed, reason


@pytest.mark.copilot_live
@pytest.mark.skipif(not live_eval_enabled(), reason="Set COPILOT_EVAL=1 to call Ollama")
@pytest.mark.skipif(not _mongo_available(), reason="MongoDB is not running")
@pytest.mark.skipif(not ollama_available(), reason="Ollama is not running")
def test_live_qwen_tool_choice() -> None:
    import asyncio

    rows = asyncio.run(run_live_cases())
    failed = [row for row in rows if not row["passed"]]
    assert not failed, "\n".join(
        f"{row['id']}: {row['reason']} (got {row['status']}/{row['tool_name']})"
        for row in failed
    )
