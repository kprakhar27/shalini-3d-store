"""
Free image-to-3D generation via the public Hugging Face TripoSR Space.

Uses `gradio_client` to call `stabilityai/TripoSR` (or any compatible Space
configured via the HF_3D_SPACE env var). No GPU / model download required
locally — the Space runs the model on Hugging Face's infrastructure.

Setting HF_TOKEN raises the rate limits but is optional for public Spaces.
"""

import os
import asyncio
import tempfile
from pathlib import Path
from typing import Any

import httpx


# Comma-separated list of TripoSR-API-compatible Spaces to try in order.
# Override via env var when one is broken (HF Spaces frequently hit RUNTIME_ERROR).
# First reachable one wins. Add more here as you find working alternatives.
SPACE_IDS = [s.strip() for s in os.getenv(
    "HF_3D_SPACE",
    # Hunyuan3D-2 first: single-call API, built-in bg removal, no session state.
    # TRELLIS / TripoSR follow as fallbacks (TRELLIS uses session state which
    # gradio_client can't fully replay; included for completeness).
    "tencent/Hunyuan3D-2,microsoft/TRELLIS,stabilityai/TripoSR",
).split(",") if s.strip()]
HF_TOKEN  = os.getenv("HF_TOKEN") or None


def _client():
    """Try each candidate Space in order; return the first one that connects.

    `gradio-client.Client.__init__` raises `ValueError` immediately if the
    Space is in `RUNTIME_ERROR` / `BUILD_ERROR` / etc. — perfect for fast
    fallback without waiting for a predict call to time out.
    """
    from gradio_client import Client
    last_err: Exception | None = None
    for sid in SPACE_IDS:
        try:
            print(f"[generate-3d] trying Space {sid!r}…")
            return Client(sid, token=HF_TOKEN) if HF_TOKEN else Client(sid)
        except Exception as e:
            print(f"[generate-3d] Space {sid!r} unavailable: {e}")
            last_err = e
    raise RuntimeError(
        "No image-to-3D Space could be reached. Tried: "
        + ", ".join(SPACE_IDS)
        + ". Either wait for the Spaces to recover, or set HF_3D_SPACE in backend/.env "
        + "to a working comma-separated list of Space IDs and restart uvicorn."
        + (f" Last error: {last_err}" if last_err else "")
    )


def _flatten(value: Any) -> list[str]:
    """Walk Gradio result and collect string paths/URLs."""
    out: list[str] = []
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for v in value.values():
            out.extend(_flatten(v))
    elif isinstance(value, (list, tuple)):
        for v in value:
            out.extend(_flatten(v))
    return out


def _pick_glb(value: Any) -> str | None:
    paths = _flatten(value)
    glbs = [p for p in paths if p.lower().endswith(".glb")]
    return glbs[0] if glbs else None


def _download_to_tempfile(url: str) -> str:
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        suffix = Path(url).suffix or ".png"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(r.content)
        tmp.close()
        return tmp.name


def _generate_sync(image_url: str) -> bytes:
    """Blocking call — must run inside an executor.

    Auto-detects the Space's API surface:
      • TRELLIS  →  /preprocess_image  →  /image_to_3d  →  /extract_glb
      • TripoSR  →  /preprocess        →  /generate
    """
    from gradio_client import handle_file
    local_image = _download_to_tempfile(image_url)
    try:
        client = _client()
        try:
            api_info = client.view_api(return_format="dict") or {}
        except Exception:
            api_info = {}
        endpoints = set((api_info.get("named_endpoints") or {}).keys())

        if "/generation_all" in endpoints:
            return _hunyuan_flow(client, local_image, handle_file)
        if "/extract_glb" in endpoints and "/image_to_3d" in endpoints:
            return _trellis_flow(client, local_image, handle_file)
        if "/generate" in endpoints and "/preprocess" in endpoints:
            return _triposr_flow(client, local_image, handle_file)

        raise RuntimeError(
            f"Unrecognised Space API. Endpoints exposed: {sorted(endpoints)}. "
            "Set HF_3D_SPACE in backend/.env to a Hunyuan3D-2-, TRELLIS-, or TripoSR-compatible Space."
        )
    finally:
        try:
            os.unlink(local_image)
        except OSError:
            pass


def _hunyuan_flow(client, local_image: str, handle_file) -> bytes:
    """Tencent Hunyuan3D-2 — single-call API. Tries /generation_all (geometry
    + PBR textures) first, then falls back to /shape_generation (geometry
    only) if the textured pipeline is currently broken on the Space's end.
    Both endpoints produce a .glb; the textured one is just nicer-looking.

    Hunyuan does its own background removal via `check_box_rembg=True`.
    """
    common_args = (
        None,                       # caption (text mode — unused)
        handle_file(local_image),   # image
        None, None, None, None,     # mv_image_front/back/left/right (single-view only)
        30,                         # steps
        5.0,                        # guidance_scale
        1234,                       # seed
        256,                        # octree_resolution
        True,                       # check_box_rembg
        8000,                       # num_chunks
        True,                       # randomize_seed
    )

    # 1. Try the full textured pipeline first.
    try:
        result = client.predict(*common_args, api_name="/generation_all")
        glb_path = _pick_glb(result)
        if glb_path:
            return Path(glb_path).read_bytes()
        raise RuntimeError(f"No .glb file in /generation_all response: {result!r}")
    except Exception as e:
        print(f"[generate-3d] /generation_all failed ({e!r}); falling back to /shape_generation")

    # 2. Fall back to geometry-only.
    result = client.predict(*common_args, api_name="/shape_generation")
    glb_path = _pick_glb(result)
    if not glb_path:
        raise RuntimeError(f"No .glb file in Hunyuan3D-2 /shape_generation response: {result!r}")
    return Path(glb_path).read_bytes()


def _trellis_flow(client, local_image: str, handle_file) -> bytes:
    # The TRELLIS Space keeps server-side state between /preprocess_image and
    # /image_to_3d via Gradio session callbacks (the /lambda_* endpoints).
    # Replaying that handshake from gradio_client is fragile and currently
    # raises FileNotFoundError on /image_to_3d. We already strip backgrounds
    # via rembg upstream, so we feed the cleaned image directly to
    # /image_to_3d, which accepts a raw image and does its own crop/normalise.
    client.predict(
        handle_file(local_image),
        [],            # multiimages — we use single-view
        0,             # seed
        7.5,           # ss_guidance_strength
        12,            # ss_sampling_steps
        3.0,           # slat_guidance_strength
        12,            # slat_sampling_steps
        "stochastic",  # multiimage_algo
        api_name="/image_to_3d",
    )

    # /extract_glb returns the actual .glb file path.
    result = client.predict(
        0.95,   # mesh_simplify
        1024,   # texture_size
        api_name="/extract_glb",
    )

    glb_path = _pick_glb(result)
    if not glb_path:
        raise RuntimeError(f"No .glb file in TRELLIS extract_glb response: {result!r}")
    return Path(glb_path).read_bytes()


def _triposr_flow(client, local_image: str, handle_file) -> bytes:
    preprocessed = client.predict(
        handle_file(local_image),
        True,   # do_remove_background
        0.85,   # foreground_ratio
        api_name="/preprocess",
    )
    result = client.predict(
        handle_file(preprocessed) if isinstance(preprocessed, str) else preprocessed,
        256,    # mc_resolution
        api_name="/generate",
    )
    glb_path = _pick_glb(result)
    if not glb_path:
        raise RuntimeError(f"No .glb file in TripoSR /generate response: {result!r}")
    return Path(glb_path).read_bytes()


GENERATION_TIMEOUT_S = 300   # 5-minute upper bound on the whole TripoSR call


async def generate_glb(image_url: str) -> bytes:
    """Generate GLB bytes from an image URL — runs blocking call in a thread pool.

    Wrapped in `asyncio.wait_for` so the job can't hang forever when the public
    Hugging Face Space is sleeping / 503-ing.
    """
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, _generate_sync, image_url),
            timeout=GENERATION_TIMEOUT_S,
        )
    except asyncio.TimeoutError as e:
        raise TimeoutError(
            f"TripoSR Space did not return within {GENERATION_TIMEOUT_S}s. "
            "The Space ({SPACE_ID}) may be cold-starting or returning 503 — try again in a few minutes."
        ) from e
