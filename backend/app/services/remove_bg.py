"""
Background removal using `rembg` (local, free, no API key).

`rembg` ships with U²-Net weights (~170 MB) downloaded on first use.
Runs on CPU in ~1–3 s per image; uses ONNX runtime under the hood.

Imported lazily so the server can boot without the (heavy) dependency
installed — the import only happens when removal is actually invoked.
"""


def remove_background(image_bytes: bytes) -> bytes:
    """Take any image bytes, return PNG bytes with transparent background."""
    from rembg import remove
    return remove(image_bytes)
