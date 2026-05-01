from fastapi import APIRouter, HTTPException
from firebase_admin import firestore

from app.models.schemas import ProductCreate, ProductUpdate
from app.services.firebase import db

router = APIRouter()


@router.get("/")
def list_products():
    docs = db().collection("products").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.get("/{product_id}")
def get_product(product_id: str):
    snap = db().collection("products").document(product_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"id": snap.id, **snap.to_dict()}


@router.post("/")
def create_product(data: ProductCreate):
    now = firestore.SERVER_TIMESTAMP
    ref = db().collection("products").add({
        **data.model_dump(),
        "imageUrls":        [],
        "glbUrl":           None,
        "thumbnailUrl":     None,
        "generationStatus": "none",
        "generationJobId":  None,
        "published":        data.published,
        "createdAt":        now,
        "updatedAt":        now,
    })[1]
    return {"id": ref.id}


@router.patch("/{product_id}")
def update_product(product_id: str, data: ProductUpdate):
    snap = db().collection("products").document(product_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    db().collection("products").document(product_id).update(updates)
    return {"ok": True}


@router.delete("/{product_id}")
def delete_product(product_id: str):
    db().collection("products").document(product_id).delete()
    return {"ok": True}
