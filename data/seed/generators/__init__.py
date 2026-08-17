"""Shared helpers for seed generators."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable, Iterator

from bson import ObjectId
from bson.decimal128 import Decimal128


def money(value: float | int | str | Decimal) -> Decimal128:
    quantized = Decimal(str(value)).quantize(Decimal("0.01"))
    return Decimal128(str(quantized))


def as_datetime(d: date) -> datetime:
    return datetime(d.year, d.month, d.day)


def daterange(start: date, end: date) -> Iterator[date]:
    """Inclusive date range."""
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def days_between(start: date, end: date) -> int:
    return (end - start).days + 1


def oid() -> ObjectId:
    return ObjectId()


def chunked(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i : i + size]
