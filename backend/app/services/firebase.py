"""Firestore client using the REST API directly via httpx.

We avoid the official Python SDK because it uses gRPC under the hood, which
hangs on some networks (HTTP/2 keepalive / proxy issues). REST is rock solid.

The helpers below cover everything the routers use; chain APIs (`.collection().document()`)
are also supported via small `Collection`/`Document`/`Query` proxies so existing router
code keeps working unchanged.
"""

import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Iterator

import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GAR
from dotenv import load_dotenv

load_dotenv()

# ── Auth + base client ────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _credentials() -> service_account.Credentials:
    return service_account.Credentials.from_service_account_info(
        {
            "type":         "service_account",
            "project_id":   os.environ["FIREBASE_PROJECT_ID"],
            "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
            "private_key":  os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
            "token_uri":    "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/datastore"],
    )


def _token() -> str:
    cred = _credentials()
    if not cred.valid:
        cred.refresh(GAR())
    return cred.token


def _project() -> str:
    return os.environ["FIREBASE_PROJECT_ID"]


def _base_url() -> str:
    return f"https://firestore.googleapis.com/v1/projects/{_project()}/databases/(default)/documents"


def _http() -> httpx.Client:
    # Cached single-process client; httpx handles connection reuse.
    global _http_client
    try:
        return _http_client
    except NameError:
        pass
    _http_client = httpx.Client(timeout=30, follow_redirects=True)
    return _http_client


def _headers() -> dict:
    return {"Authorization": f"Bearer {_token()}", "Content-Type": "application/json"}


# ── Type encoding/decoding (Firestore JSON ⇄ Python) ──────────────────────────

def _encode(v: Any) -> dict:
    if v is None:                              return {"nullValue": None}
    if isinstance(v, bool):                    return {"booleanValue": v}
    if isinstance(v, int):                     return {"integerValue": str(v)}
    if isinstance(v, float):                   return {"doubleValue": v}
    if isinstance(v, str):                     return {"stringValue": v}
    if isinstance(v, datetime):
        d = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        return {"timestampValue": d.isoformat().replace("+00:00", "Z")}
    if isinstance(v, list):                    return {"arrayValue": {"values": [_encode(x) for x in v]}}
    if isinstance(v, dict):                    return {"mapValue":   {"fields": {k: _encode(x) for k, x in v.items()}}}
    raise TypeError(f"Unsupported Firestore value type: {type(v)}")


def _decode(field: dict) -> Any:
    (key, val), = field.items()
    if key == "nullValue":      return None
    if key == "booleanValue":   return val
    if key == "integerValue":   return int(val)
    if key == "doubleValue":    return float(val)
    if key == "stringValue":    return val
    if key == "timestampValue": return val
    if key == "arrayValue":     return [_decode(x) for x in val.get("values", [])]
    if key == "mapValue":       return {k: _decode(x) for k, x in val.get("fields", {}).items()}
    return val  # geoPoint, referenceValue, bytesValue — fall through as raw


def _encode_fields(data: dict) -> dict:
    return {k: _encode(v) for k, v in data.items()}


def _decode_fields(fields: dict) -> dict:
    return {k: _decode(v) for k, v in (fields or {}).items()}


def _doc_id_from_name(name: str) -> str:
    return name.rsplit("/", 1)[-1]


# ── Snapshot proxy (mimics google.cloud.firestore.DocumentSnapshot) ───────────

class _Snapshot:
    def __init__(self, doc: dict | None, doc_id: str):
        self._doc = doc
        self.id = doc_id
        self.exists = doc is not None and "fields" in doc

    def to_dict(self) -> dict | None:
        return _decode_fields(self._doc.get("fields", {})) if self.exists else None


# ── Document / Collection / Query proxies ─────────────────────────────────────

class Document:
    def __init__(self, collection_path: str, doc_id: str):
        self.collection_path = collection_path
        self.id = doc_id

    @property
    def _url(self) -> str:
        return f"{_base_url()}/{self.collection_path}/{self.id}"

    def get(self) -> _Snapshot:
        r = _http().get(self._url, headers=_headers())
        if r.status_code == 404:
            return _Snapshot(None, self.id)
        r.raise_for_status()
        return _Snapshot(r.json(), self.id)

    def set(self, data: dict, merge: bool = False) -> None:
        body = {"fields": _encode_fields(data)}
        params = {}
        if merge:
            params["updateMask.fieldPaths"] = list(data.keys())
        r = _http().patch(self._url, headers=_headers(), json=body, params=params)
        r.raise_for_status()

    def update(self, data: dict) -> None:
        body = {"fields": _encode_fields(data)}
        params = [("updateMask.fieldPaths", k) for k in data.keys()]
        r = _http().patch(self._url, headers=_headers(), json=body, params=params)
        r.raise_for_status()

    def delete(self) -> None:
        r = _http().delete(self._url, headers=_headers())
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()


class Query:
    """Composable where/order_by/limit chain that fires runQuery on stream()."""
    def __init__(self, collection_id: str, filters: list | None = None, order: list | None = None, limit: int | None = None):
        self.collection_id = collection_id
        self.filters = filters or []
        self.order   = order or []
        self.limit_  = limit

    def where(self, field: str, op: str, value: Any) -> "Query":
        op_map = {"==": "EQUAL", "!=": "NOT_EQUAL", "<": "LESS_THAN", "<=": "LESS_THAN_OR_EQUAL",
                  ">": "GREATER_THAN", ">=": "GREATER_THAN_OR_EQUAL", "in": "IN", "array-contains": "ARRAY_CONTAINS"}
        return Query(self.collection_id,
                     self.filters + [{"fieldFilter": {"field": {"fieldPath": field}, "op": op_map[op], "value": _encode(value)}}],
                     self.order, self.limit_)

    def order_by(self, field: str, direction: str = "ASCENDING") -> "Query":
        d = direction.upper() if isinstance(direction, str) else direction
        if d not in ("ASCENDING", "DESCENDING"):
            d = "DESCENDING" if str(direction).lower().startswith("desc") else "ASCENDING"
        return Query(self.collection_id, self.filters, self.order + [{"field": {"fieldPath": field}, "direction": d}], self.limit_)

    def limit(self, n: int) -> "Query":
        return Query(self.collection_id, self.filters, self.order, n)

    def _structured(self) -> dict:
        q: dict = {"from": [{"collectionId": self.collection_id}]}
        if self.filters:
            q["where"] = {"compositeFilter": {"op": "AND", "filters": self.filters}} if len(self.filters) > 1 else self.filters[0]
        if self.order:
            q["orderBy"] = self.order
        if self.limit_ is not None:
            q["limit"] = self.limit_
        return q

    def stream(self) -> Iterator[_Snapshot]:
        url = f"{_base_url()}:runQuery"
        r = _http().post(url, headers=_headers(), json={"structuredQuery": self._structured()})
        r.raise_for_status()
        for row in r.json():
            doc = row.get("document")
            if not doc:
                continue
            yield _Snapshot(doc, _doc_id_from_name(doc["name"]))


class Collection:
    def __init__(self, name: str):
        self.name = name

    def document(self, doc_id: str | None = None) -> Document:
        # When called with no id, generate one client-side (matches firestore.add())
        if doc_id is None:
            import secrets
            doc_id = secrets.token_urlsafe(16).replace("_", "").replace("-", "")[:20]
        return Document(self.name, doc_id)

    def add(self, data: dict) -> tuple[Any, Document]:
        """Mirrors firestore.Client.collection(...).add(...) → (write_result, DocumentReference)."""
        url = f"{_base_url()}/{self.name}"
        r = _http().post(url, headers=_headers(), json={"fields": _encode_fields(data)})
        r.raise_for_status()
        name = r.json()["name"]
        return None, Document(self.name, _doc_id_from_name(name))

    def where(self, field: str, op: str, value: Any) -> Query:
        return Query(self.name).where(field, op, value)

    def order_by(self, field: str, direction: str = "ASCENDING") -> Query:
        return Query(self.name).order_by(field, direction)

    def limit(self, n: int) -> Query:
        return Query(self.name).limit(n)

    def stream(self) -> Iterator[_Snapshot]:
        # List all documents under this collection
        url = f"{_base_url()}/{self.name}"
        r = _http().get(url, headers=_headers())
        r.raise_for_status()
        for doc in r.json().get("documents", []):
            yield _Snapshot(doc, _doc_id_from_name(doc["name"]))


class _Client:
    def collection(self, name: str) -> Collection:
        return Collection(name)


def db() -> _Client:
    return _Client()


# ── High-level helpers used elsewhere ─────────────────────────────────────────

def get_product(product_id: str) -> dict:
    snap = Document("products", product_id).get()
    return snap.to_dict() or {}


def update_product(product_id: str, data: dict) -> None:
    data["updatedAt"] = datetime.now(timezone.utc)
    Document("products", product_id).update(data)


def create_job(data: dict) -> str:
    data["startedAt"] = datetime.now(timezone.utc)
    _, doc = Collection("generationJobs").add(data)
    return doc.id


def update_job(job_id: str, data: dict) -> None:
    Document("generationJobs", job_id).update(data)


def get_jobs_by_status(status: str) -> list[dict]:
    return [
        {"id": s.id, **(s.to_dict() or {})}
        for s in Collection("generationJobs").where("status", "==", status).stream()
    ]
