import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException

from app.models.schemas import BgRemoveRequest, Generate3DRequest
from app.services import firebase as fb
from app.services import r2
from app.services.remove_bg import remove_background
from app.services.local_3d import generate_glb

router = APIRouter()


# ── Background removal — synchronous, runs locally with rembg ────────────────

@router.post("/generate-bg-remove")
async def generate_bg_remove(req: BgRemoveRequest):
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            r = await client.get(req.imageUrl)
            r.raise_for_status()
            image_bytes = r.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to download image: {e}")

    try:
        loop = asyncio.get_running_loop()
        png_bytes = await loop.run_in_executor(None, remove_background, image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e}")

    path = f"products/{req.productId}/cleaned_{int(datetime.now().timestamp())}.png"
    cleaned_url = r2.upload_bytes(path, png_bytes, "image/png")

    existing = fb.get_product(req.productId).get("imageUrls", [])
    fb.update_product(req.productId, {"imageUrls": existing + [cleaned_url]})

    return {"cleanedUrl": cleaned_url}


# ── 3D generation — async, runs as a fire-and-forget background task ─────────

async def _run_3d_generation(job_id: str, product_id: str, image_url: str) -> None:
    try:
        glb_bytes = await generate_glb(image_url)
        glb_url = r2.upload_bytes(
            f"products/{product_id}/model.glb",
            glb_bytes,
            "model/gltf-binary",
        )
        fb.update_job(job_id, {
            "status":       "completed",
            "outputGlbUrl": glb_url,
            "completedAt":  datetime.now(timezone.utc),
        })
        fb.update_product(product_id, {
            "glbUrl":           glb_url,
            "generationStatus": "completed",
        })
    except Exception as exc:
        import traceback
        print(f"[generate-3d] job {job_id} failed: {exc}")
        traceback.print_exc()
        fb.update_job(job_id, {"status": "failed", "errorMessage": str(exc)})
        fb.update_product(product_id, {"generationStatus": "failed"})


@router.post("/generate-3d")
async def generate_3d(req: Generate3DRequest):
    job_id = fb.create_job({
        "productId":     req.productId,
        "provider":      "triposr-hf",
        "status":        "processing",
        "inputImageUrl": req.imageUrl,
        "outputGlbUrl":  None,
        "providerJobId": None,
        "errorMessage":  None,
        "completedAt":   None,
    })

    fb.update_product(req.productId, {
        "generationStatus": "processing",
        "generationJobId":  job_id,
    })

    asyncio.create_task(_run_3d_generation(job_id, req.productId, req.imageUrl))

    return {"jobId": job_id}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    snap = fb.db().collection("generationJobs").document(job_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"id": snap.id, **snap.to_dict()}
