from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from pydantic import BaseModel
from typing import Optional

from app.services.firebase import db

router = APIRouter()


class CategoryCreate(BaseModel):
    label: str
    meshType: str
    color: str
    position: list[float]
    order: int = 0


class SubcategoryCreate(BaseModel):
    categoryId: str
    label: str
    order: int = 0


@router.get("/")
def list_categories():
    docs = db().collection("categories").order_by("order").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/")
def create_category(data: CategoryCreate):
    now = firestore.SERVER_TIMESTAMP
    ref = db().collection("categories").add({**data.model_dump(), "createdAt": now})[1]
    return {"id": ref.id}


@router.patch("/{category_id}")
def update_category(category_id: str, data: CategoryCreate):
    db().collection("categories").document(category_id).update({
        **data.model_dump(), "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"ok": True}


@router.delete("/{category_id}")
def delete_category(category_id: str):
    db().collection("categories").document(category_id).delete()
    return {"ok": True}


# ── Subcategories ─────────────────────────────────────────────────────────────

@router.get("/subcategories")
def list_subcategories(categoryId: Optional[str] = None):
    q = db().collection("subcategories")
    if categoryId:
        q = q.where("categoryId", "==", categoryId)
    return [{"id": d.id, **d.to_dict()} for d in q.stream()]


@router.post("/subcategories")
def create_subcategory(data: SubcategoryCreate):
    now = firestore.SERVER_TIMESTAMP
    ref = db().collection("subcategories").add({**data.model_dump(), "createdAt": now})[1]
    return {"id": ref.id}


@router.delete("/subcategories/{sub_id}")
def delete_subcategory(sub_id: str):
    db().collection("subcategories").document(sub_id).delete()
    return {"ok": True}
