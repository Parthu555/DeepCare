"""
Medical Imaging & Report Storage Streaming Service
Serves encrypted and locally cached radiographs, Grad-CAM overlays, and reports
directly to the DeepCare web client.
"""
import io
import mimetypes
import logging
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.s3_service import download_s3_object

router = APIRouter(prefix="/storage", tags=["Storage"])
logger = logging.getLogger(__name__)

@router.get("/view")
def view_storage_object(key: str = Query(..., description="S3 storage key or cached path")):
    """Securely stream a stored medical image, Grad-CAM heatmap, or report PDF."""
    data = download_s3_object(key)
    if not data:
        raise HTTPException(status_code=404, detail=f"Medical asset not found: {key}")

    mime, _ = mimetypes.guess_type(key)
    if not mime:
        if key.lower().endswith(".png"):
            mime = "image/png"
        elif key.lower().endswith((".jpg", ".jpeg")):
            mime = "image/jpeg"
        elif key.lower().endswith(".pdf"):
            mime = "application/pdf"
        else:
            mime = "application/octet-stream"

    return Response(
        content=data,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{key.split("/")[-1]}"',
        },
    )
