from fastapi import APIRouter
from pydantic import BaseModel

from app.services import r2

router = APIRouter()


class PresignedUploadRequest(BaseModel):
    productId: str
    filename: str
    contentType: str = "image/jpeg"


@router.post("/presigned-upload")
def presigned_upload(req: PresignedUploadRequest):
    key = f"products/{req.productId}/original_{req.filename}"
    upload_url = r2.presigned_put_url(key, req.contentType)
    return {
        "uploadUrl": upload_url,
        "publicUrl": r2.public_url(key),
        "key":       key,
    }
