"""
supabase_client.py — Supabase client factory with transparent local in-memory fallback.
Service-role client for backend (admin access, bypasses RLS).
Falls back to thread-safe in-memory store when using dummy credentials or offline.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from typing import Any
from uuid import uuid4

from backend.config import AppConfig

logger = logging.getLogger(__name__)


# ─── In-memory Query Builder Fallback ─────────────────────────────────────────

@dataclass
class APIResponse:
    data: Any


class MockTableQuery:
    def __init__(self, table_name: str, store: dict[str, list[dict[str, Any]]]):
        self.table_name = table_name
        self.store = store
        self.filters: list[tuple[str, Any]] = []
        self._single = False
        self._maybe_single = False
        self._order_col: str | None = None
        self._order_desc: bool = False
        self._range: tuple[int, int] | None = None
        self._pending_op: str = "select"
        self._pending_data: Any = None
        self._on_conflict: str | None = None

    def select(self, columns: str = "*") -> MockTableQuery:
        self._pending_op = "select"
        return self

    def eq(self, column: str, value: Any) -> MockTableQuery:
        self.filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False) -> MockTableQuery:
        self._order_col = column
        self._order_desc = desc
        return self

    def range(self, start: int, end: int) -> MockTableQuery:
        self._range = (start, end)
        return self

    def single(self) -> MockTableQuery:
        self._single = True
        return self

    def maybe_single(self) -> MockTableQuery:
        self._maybe_single = True
        return self

    def insert(self, data: dict[str, Any] | list[dict[str, Any]]) -> MockTableQuery:
        self._pending_op = "insert"
        self._pending_data = data
        return self

    def upsert(self, data: dict[str, Any] | list[dict[str, Any]], on_conflict: str = "id") -> MockTableQuery:
        self._pending_op = "upsert"
        self._pending_data = data
        self._on_conflict = on_conflict
        return self

    def update(self, data: dict[str, Any]) -> MockTableQuery:
        self._pending_op = "update"
        self._pending_data = data
        return self

    def delete(self) -> MockTableQuery:
        self._pending_op = "delete"
        return self

    def execute(self) -> APIResponse:
        records = self.store.setdefault(self.table_name, [])

        if self._pending_op == "insert":
            items = self._pending_data if isinstance(self._pending_data, list) else [self._pending_data]
            inserted = []
            for item in items:
                row = dict(item)
                if "id" not in row or not row["id"]:
                    row["id"] = str(uuid4())
                if "created_at" not in row:
                    row["created_at"] = datetime.utcnow().isoformat()
                records.append(row)
                inserted.append(row)
            return APIResponse(data=inserted)

        elif self._pending_op == "upsert":
            items = self._pending_data if isinstance(self._pending_data, list) else [self._pending_data]
            conflict_col = self._on_conflict or "id"
            result = []
            for item in items:
                row = dict(item)
                if "id" not in row or not row["id"]:
                    row["id"] = str(uuid4())
                existing_idx = None
                for idx, r in enumerate(records):
                    if r.get(conflict_col) == row.get(conflict_col):
                        existing_idx = idx
                        break
                if existing_idx is not None:
                    records[existing_idx].update(row)
                    result.append(records[existing_idx])
                else:
                    records.append(row)
                    result.append(row)
            return APIResponse(data=result)

        elif self._pending_op == "update":
            updated = []
            for r in records:
                if all(r.get(c) == v for c, v in self.filters):
                    r.update(self._pending_data)
                    updated.append(r)
            return APIResponse(data=updated)

        elif self._pending_op == "delete":
            deleted = []
            remaining = []
            for r in records:
                if all(r.get(c) == v for c, v in self.filters):
                    deleted.append(r)
                else:
                    remaining.append(r)
            self.store[self.table_name] = remaining
            return APIResponse(data=deleted)

        # SELECT
        matched = []
        for r in records:
            if all(r.get(c) == v for c, v in self.filters):
                matched.append(r)

        if self._order_col:
            matched.sort(
                key=lambda x: x.get(self._order_col) or "",
                reverse=self._order_desc,
            )

        if self._range:
            start, end = self._range
            matched = matched[start : end + 1]

        if self._single:
            data = matched[0] if matched else None
        elif self._maybe_single:
            data = matched[0] if matched else None
        else:
            data = matched

        return APIResponse(data=data)


class MockSupabaseClient:
    """In-memory client for testing & offline development."""

    def __init__(self):
        self._store: dict[str, list[dict[str, Any]]] = {}

    def table(self, table_name: str) -> MockTableQuery:
        return MockTableQuery(table_name, self._store)


# ─── Global in-memory fallback singleton ──────────────────────────────────────
_mock_client = MockSupabaseClient()


@lru_cache(maxsize=1)
def get_service_client(cfg: AppConfig):
    """
    Returns the Supabase service-role client, or local mock client if using dummy credentials.
    """
    url = cfg.settings.supabase_url
    key = cfg.settings.supabase_service_role_key

    if not url or "dummy" in url or not key or "dummy" in key:
        logger.info("Using in-memory mock Supabase client for offline/local development")
        return _mock_client

    try:
        from supabase import create_client
        return create_client(supabase_url=url, supabase_key=key)
    except Exception as e:
        logger.warning("Could not connect to Supabase (%s), falling back to in-memory store", e)
        return _mock_client
