"""
Seed Firestore with dummy categories, subcategories, and products.

Run from the backend directory:
    python -u scripts/seed.py

The storefront picks up changes live via Firestore onSnapshot — no restart
needed. GLB URLs are left as null; generate them per-product in the admin
panel via "Generate 3D" once you've installed the heavy AI deps
(`pip install rembg pillow onnxruntime gradio-client`).
"""

import os
import sys
from datetime import datetime, timezone

# Make `app.*` importable when run from anywhere
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import firebase as fb


CATEGORIES = [
    {"id": "living",  "label": "Living Room", "meshType": "sofa",  "color": "#7c6af7", "position": [-4, 0, -3], "order": 0,
     "subcategories": ["Seating", "Tables"]},
    {"id": "bedroom", "label": "Bedroom",     "meshType": "bed",   "color": "#f77c9c", "position": [ 4, 0, -3], "order": 1,
     "subcategories": ["Beds", "Storage"]},
    {"id": "dining",  "label": "Dining Room", "meshType": "table", "color": "#7cf7c6", "position": [-4, 0,  3], "order": 2,
     "subcategories": ["Tables", "Chairs"]},
    {"id": "office",  "label": "Office",      "meshType": "desk",  "color": "#f7c67c", "position": [ 4, 0,  3], "order": 3,
     "subcategories": ["Desks", "Shelving"]},
]


# (name, price, description, categoryId, subcategoryLabel, variants)
PRODUCTS = [
    # ── Living Room / Seating ────────────────────────────────────────────────
    ("Cloud Sofa",      1299, "Deep-seat three-seater with feather cushions",       "living",  "Seating",  [
        {"label": "Slate Blue",   "color": "#5b7aa8"},
        {"label": "Warm Grey",    "color": "#9e9e8e"},
        {"label": "Forest Green", "color": "#4a7c59"}]),
    ("Arc Loveseat",     849, "Curved silhouette with velvet upholstery",           "living",  "Seating",  [
        {"label": "Dusty Rose",   "color": "#c47a7a"},
        {"label": "Ivory",        "color": "#d4cfc4"},
        {"label": "Midnight",     "color": "#2c2c44"}]),
    ("Mod Armchair",     649, "Mid-century modern with walnut legs",                "living",  "Seating",  [
        {"label": "Caramel",      "color": "#c4894a"},
        {"label": "Teal",         "color": "#3a8c8c"},
        {"label": "Charcoal",     "color": "#4a4a5a"}]),

    # ── Living Room / Tables ─────────────────────────────────────────────────
    ("Halo Coffee Table", 449, "Round walnut top on hairpin steel legs",            "living",  "Tables",   [
        {"label": "Walnut",       "color": "#7a4a2c"},
        {"label": "Oak",          "color": "#c4a47a"}]),
    ("Marble Side Table", 329, "Honed marble cylinder pedestal",                    "living",  "Tables",   [
        {"label": "Carrara White","color": "#e0e0d8"},
        {"label": "Nero Black",   "color": "#2a2a2a"}]),

    # ── Bedroom / Beds ───────────────────────────────────────────────────────
    ("Drift Platform Bed",1499, "Low-profile platform with upholstered headboard",  "bedroom", "Beds",     [
        {"label": "Linen Beige",  "color": "#c8b89a"},
        {"label": "Slate Grey",   "color": "#5a6a7a"}]),
    ("Canopy Four-Poster",2199, "Solid oak frame with linen drapes",                "bedroom", "Beds",     [
        {"label": "Natural Oak",  "color": "#c4a47a"},
        {"label": "Black Stain",  "color": "#1a1a1a"}]),

    # ── Bedroom / Storage ────────────────────────────────────────────────────
    ("Plywood Dresser",   799, "Six-drawer dresser with brass pulls",               "bedroom", "Storage",  [
        {"label": "Birch",        "color": "#d8c4a8"},
        {"label": "Walnut",       "color": "#7a4a2c"}]),
    ("Wardrobe XL",      1099, "Full-height closet with sliding doors",             "bedroom", "Storage",  [
        {"label": "White Oak",    "color": "#e8d8b8"},
        {"label": "Espresso",     "color": "#3a2a1a"}]),

    # ── Dining / Tables ──────────────────────────────────────────────────────
    ("Live Edge Dining", 1899, "Single-slab walnut on steel base, seats 8",         "dining",  "Tables",   [
        {"label": "Walnut",       "color": "#7a4a2c"},
        {"label": "Maple",        "color": "#e0c89a"}]),
    ("Round Pedestal",   1149, "Tulip-style pedestal with marble top, seats 4",     "dining",  "Tables",   [
        {"label": "White Marble", "color": "#f0f0e8"},
        {"label": "Black Marble", "color": "#1a1a1a"}]),

    # ── Dining / Chairs ──────────────────────────────────────────────────────
    ("Wishbone Chair",    299, "Hand-woven paper cord seat, oak frame",             "dining",  "Chairs",   [
        {"label": "Natural",      "color": "#d8c4a8"},
        {"label": "Black",        "color": "#1a1a1a"},
        {"label": "Smoked Oak",   "color": "#7a5a3a"}]),
    ("Tulip Side Chair",  379, "Molded shell on swivel pedestal",                   "dining",  "Chairs",   [
        {"label": "White",        "color": "#f0f0e8"},
        {"label": "Cherry",       "color": "#aa3a3a"},
        {"label": "Black",        "color": "#1a1a1a"}]),

    # ── Office / Desks ───────────────────────────────────────────────────────
    ("Standing Desk Pro", 949, "Electric height adjust, walnut top",                "office",  "Desks",    [
        {"label": "Walnut",         "color": "#7a4a2c"},
        {"label": "White Laminate", "color": "#f0f0e8"}]),
    ("Bauhaus Writing",   729, "Tubular steel frame, oak surface",                  "office",  "Desks",    [
        {"label": "Oak/Black",      "color": "#3a3a3a"},
        {"label": "Oak/Chrome",     "color": "#c0c0c0"}]),

    # ── Office / Shelving ────────────────────────────────────────────────────
    ("Modular Shelf",     599, "Powder-coated steel grid, customizable height",    "office",  "Shelving", [
        {"label": "Matte Black",  "color": "#1a1a1a"},
        {"label": "Sage Green",   "color": "#7a8a5a"}]),
    ("Floating Wall Shelf",199,"Solid oak with concealed brackets",                "office",  "Shelving", [
        {"label": "Natural Oak",  "color": "#c4a47a"},
        {"label": "Whitewashed",  "color": "#e8e0d0"}]),
]


def wipe(collection: str) -> int:
    """Delete all docs in a collection. Returns count."""
    count = 0
    for snap in fb.Collection(collection).stream():
        fb.Document(collection, snap.id).delete()
        count += 1
    return count


def seed() -> None:
    print("Wiping existing data…")
    for col in ("products", "subcategories", "categories"):
        n = wipe(col)
        print(f"  • {col}: deleted {n}")

    now = datetime.now(timezone.utc)

    print("\nCategories:")
    for cat in CATEGORIES:
        fb.Document("categories", cat["id"]).set({
            "label":     cat["label"],
            "meshType":  cat["meshType"],
            "color":     cat["color"],
            "position":  cat["position"],
            "order":     cat["order"],
            "createdAt": now,
        })
        print(f"  ✓ {cat['id']}: {cat['label']}")

    print("\nSubcategories:")
    sub_order = 0
    for cat in CATEGORIES:
        for label in cat["subcategories"]:
            _, ref = fb.Collection("subcategories").add({
                "categoryId": cat["id"],
                "label":      label,
                "order":      sub_order,
                "createdAt":  now,
            })
            print(f"  ✓ {cat['id']}/{label}  (id={ref.id})")
            sub_order += 1

    print("\nProducts:")
    for i, (name, price, desc, cat_id, sub_label, variants) in enumerate(PRODUCTS):
        _, ref = fb.Collection("products").add({
            "name":             name,
            "description":      desc,
            "price":            price,
            "categoryId":       cat_id,
            "subcategoryId":    sub_label,
            "variants":         variants,
            "imageUrls":        [],
            "glbUrl":           None,
            "thumbnailUrl":     None,
            "generationStatus": "none",
            "generationJobId":  None,
            "published":        True,
            "order":            i,
            "createdAt":        now,
            "updatedAt":        now,
        })
        print(f"  ✓ {name}  ({cat_id}/{sub_label})  → {ref.id}")

    print(f"\n✅ Seeded {len(CATEGORIES)} categories, "
          f"{sum(len(c['subcategories']) for c in CATEGORIES)} subcategories, "
          f"{len(PRODUCTS)} products.")
    print("\n→ Open http://localhost:5173 — products should appear immediately (Firestore onSnapshot).")
    print("→ For 3D models: open http://localhost:5173/admin/products and click 'Generate 3D' on each.")


if __name__ == "__main__":
    seed()
