"""
Unified image generation service.
Replaces avatar-gen, item-image-gen, location-image-gen stubs.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
import generator
import job_queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("image-gen")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CallbackConfig(BaseModel):
    url: str
    method: Literal["POST", "PUT", "PATCH"] = "POST"
    headers: dict[str, str] = Field(default_factory=dict)


class ImageOptions(BaseModel):
    width: int = Field(default=config.DEFAULT_WIDTH, ge=64, le=2048)
    height: int = Field(default=config.DEFAULT_HEIGHT, ge=64, le=2048)
    format: Literal["png", "jpeg", "webp"] = config.DEFAULT_FORMAT


class GenerateRequest(BaseModel):
    entityType: Literal["character", "item", "location"]
    record: dict[str, Any]
    style: str | None = None
    options: ImageOptions | None = None
    callback: CallbackConfig


class JobStatusResponse(BaseModel):
    jobId: str
    status: str
    queuePosition: int | None = None
    error: str | None = None


class StyleInfo(BaseModel):
    id: str
    name: str
    description: str


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting image-gen service...")
    generator.load_model()
    task = asyncio.create_task(job_queue.worker())
    yield
    task.cancel()


app = FastAPI(title="image-gen", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "up",
        "service": "image-gen",
        "model": config.MODEL_ID,
        "queueSize": job_queue.get_queue_size(),
    }


@app.post("/generate", status_code=202)
async def generate(req: GenerateRequest):
    opts = req.options or ImageOptions()

    if req.entityType == "location" and opts.width == config.DEFAULT_WIDTH and opts.height == config.DEFAULT_HEIGHT:
        opts.width = 1344
        opts.height = 768

    job = await job_queue.enqueue(
        entity_type=req.entityType,
        record=req.record,
        style=req.style,
        width=opts.width,
        height=opts.height,
        image_format=opts.format,
        callback_url=req.callback.url,
        callback_method=req.callback.method,
        callback_headers=req.callback.headers,
    )

    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "jobId": job.id,
            "status": job.status.value,
            "queuePosition": job.queue_position,
        },
    )


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = job_queue.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "jobId": job.id,
        "status": job.status.value,
        "entityType": job.entity_type,
        "queuePosition": job.queue_position if job.status == job_queue.JobStatus.QUEUED else None,
        "error": job.error,
    }


@app.get("/styles")
async def get_styles():
    return {
        "character": [
            StyleInfo(id="portrait", name="Portrait Painting", description="Ritratto a olio in stile classico"),
            StyleInfo(id="photorealistic", name="Photorealistic", description="Fotorealistico anni '20"),
            StyleInfo(id="illustrated", name="Illustrated", description="Illustrazione stilizzata"),
            StyleInfo(id="noir", name="Noir Sketch", description="Schizzo noir in bianco e nero"),
        ],
        "item": [
            StyleInfo(id="realistic", name="Realistic Victorian", description="Illustrazione realistica vittoriana"),
            StyleInfo(id="illustrated", name="Illustrated", description="Illustrazione stilizzata"),
            StyleInfo(id="sketch", name="Pencil Sketch", description="Schizzo a matita"),
            StyleInfo(id="icon", name="Game Icon", description="Icona per inventario di gioco"),
        ],
        "location": [
            StyleInfo(id="atmospheric", name="Atmospheric Painting", description="Dipinto atmosferico"),
            StyleInfo(id="photorealistic", name="Photorealistic", description="Fotorealistico anni '20"),
            StyleInfo(id="noir", name="Noir Photography", description="Fotografia noir in bianco e nero"),
            StyleInfo(id="watercolor", name="Watercolor", description="Acquerello"),
        ],
    }


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, log_level="info")
