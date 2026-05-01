"""
Pre-populate a few seeded products with public Khronos sample GLB URLs.

These are well-known glTF test assets — not furniture, but they prove the
storefront's `useGLTF` + Firestore onSnapshot pipeline works end-to-end
without anyone needing to run rembg / TripoSR first.
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import firebase as fb


# Public Khronos sample-model GLBs (CORS-friendly, served via GitHub raw).
# Pick one per category for visual variety.
ASSIGNMENTS = {
    "Cloud Sofa":          "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
    "Mod Armchair":        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb",
    "Drift Platform Bed":  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb",
    "Live Edge Dining":    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoomBox/glTF-Binary/BoomBox.glb",
    "Standing Desk Pro":   "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/glTF-Binary/Lantern.glb",
}


def main() -> None:
    matched: dict[str, str] = {}
    for snap in fb.Collection("products").stream():
        data = snap.to_dict() or {}
        name = data.get("name")
        if name in ASSIGNMENTS:
            url = ASSIGNMENTS[name]
            fb.Document("products", snap.id).update({"glbUrl": url})
            matched[name] = snap.id
            print(f"  ✓ {name:25} ← {url.rsplit('/', 3)[-3]}.glb  (id={snap.id})")

    missing = set(ASSIGNMENTS) - set(matched)
    if missing:
        print(f"\n⚠ Not found in Firestore: {sorted(missing)}")
        print("  Run scripts/seed.py first to create the products.")
    else:
        print(f"\n✅ Updated {len(matched)} products. Refresh the storefront to see them.")


if __name__ == "__main__":
    main()
