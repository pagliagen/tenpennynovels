"""
Image generation pipeline.

Supports two modes controlled by IMAGE_GEN_MODE:
  - "local": loads a diffusers model on device (MPS/CUDA/CPU)
  - "api":   calls Stability AI REST API (SD 3.5 Large Turbo etc.)
"""

import io
import base64
import logging
import random
import time

import httpx
from PIL import Image

import config

logger = logging.getLogger("image-gen.generator")

_pipe = None

# ---------------------------------------------------------------------------
# Device helper (local mode only)
# ---------------------------------------------------------------------------

def _resolve_device() -> str:
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

# ---------------------------------------------------------------------------
# Model loading (local mode only)
# ---------------------------------------------------------------------------

def load_model() -> None:
    """Load the local diffusers pipeline. Skipped when IMAGE_GEN_MODE=api."""
    if config.IMAGE_GEN_MODE != "local":
        logger.info(f"Skipping local model load (mode={config.IMAGE_GEN_MODE})")
        return

    global _pipe
    import torch
    from diffusers import AutoPipelineForText2Image

    device = _resolve_device()
    dtype = torch.float16 if device == "cuda" else torch.float32

    logger.info(f"Loading model {config.MODEL_ID} on {device} (dtype={dtype})")
    start = time.time()

    _pipe = AutoPipelineForText2Image.from_pretrained(
        config.MODEL_ID,
        torch_dtype=dtype,
        token=config.HUGGINGFACE_TOKEN or None,
        safety_checker=None,
        requires_safety_checker=False,
    )

    if device == "cuda":
        _pipe.enable_model_cpu_offload()
    else:
        _pipe = _pipe.to(device)

    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()

    elapsed = time.time() - start
    logger.info(f"Model loaded in {elapsed:.1f}s on {device}")

# ---------------------------------------------------------------------------
# Local generation
# ---------------------------------------------------------------------------

def _generate_local(
    prompt: str,
    width: int,
    height: int,
    image_format: str,
    seed: int,
    steps: int,
    scale: float,
) -> dict:
    import torch

    if _pipe is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    generator = torch.Generator(device="cpu").manual_seed(seed)

    logger.info(f"[local] Generating: {width}x{height}, steps={steps}, seed={seed}")
    start = time.time()

    result = _pipe(
        prompt=prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=scale,
        generator=generator,
    )

    image: Image.Image = result.images[0]
    processing_ms = int((time.time() - start) * 1000)

    buf = io.BytesIO()
    pil_format = {"png": "PNG", "jpeg": "JPEG", "webp": "WEBP"}.get(image_format, "PNG")
    image.save(buf, format=pil_format)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    logger.info(f"[local] Generated in {processing_ms}ms, size={len(buf.getvalue())} bytes")

    return {
        "base64": b64,
        "format": image_format,
        "width": image.width,
        "height": image.height,
        "seed": seed,
        "steps": steps,
        "processing_ms": processing_ms,
    }

# ---------------------------------------------------------------------------
# Stability AI API generation
# ---------------------------------------------------------------------------

ASPECT_RATIO_MAP = {
    (512, 512): "1:1",
    (1024, 1024): "1:1",
    (768, 512): "3:2",
    (512, 768): "2:3",
    (1024, 576): "16:9",
    (576, 1024): "9:16",
}


def _pick_aspect_ratio(width: int, height: int) -> str:
    key = (width, height)
    if key in ASPECT_RATIO_MAP:
        return ASPECT_RATIO_MAP[key]
    ratio = width / height
    if ratio > 1.7:
        return "16:9"
    if ratio > 1.3:
        return "3:2"
    if ratio < 0.6:
        return "9:16"
    if ratio < 0.8:
        return "2:3"
    return "1:1"


def _generate_api(
    prompt: str,
    width: int,
    height: int,
    image_format: str,
    seed: int,
    **_kwargs,
) -> dict:
    if not config.STABILITY_API_KEY:
        raise RuntimeError("STABILITY_API_KEY not configured")

    aspect = _pick_aspect_ratio(width, height)
    out_fmt = image_format if image_format in ("png", "jpeg", "webp") else "png"

    logger.info(f"[api] Calling Stability AI ({config.STABILITY_MODEL}), aspect={aspect}, seed={seed}")
    start = time.time()

    form_data = {
        "model": config.STABILITY_MODEL,
        "prompt": prompt,
        "output_format": out_fmt,
        "aspect_ratio": aspect,
        "seed": str(seed),
    }

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            config.STABILITY_API_URL,
            headers={
                "Authorization": f"Bearer {config.STABILITY_API_KEY}",
                "Accept": "image/*",
            },
            data=form_data,
        )

    if resp.status_code != 200:
        body = resp.text[:500]
        raise RuntimeError(f"Stability API error {resp.status_code}: {body}")

    image_bytes = resp.content
    processing_ms = int((time.time() - start) * 1000)

    image = Image.open(io.BytesIO(image_bytes))
    b64 = base64.b64encode(image_bytes).decode("ascii")

    logger.info(f"[api] Generated in {processing_ms}ms, size={len(image_bytes)} bytes, {image.width}x{image.height}")

    return {
        "base64": b64,
        "format": out_fmt,
        "width": image.width,
        "height": image.height,
        "seed": seed,
        "steps": 0,
        "processing_ms": processing_ms,
    }

# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_image(
    prompt: str,
    width: int = config.DEFAULT_WIDTH,
    height: int = config.DEFAULT_HEIGHT,
    image_format: str = config.DEFAULT_FORMAT,
    seed: int | None = None,
    num_inference_steps: int | None = None,
    guidance_scale: float | None = None,
) -> dict:
    """
    Generate an image from a text prompt.
    Routes to local model or Stability AI API based on IMAGE_GEN_MODE.
    Returns dict with base64, format, width, height, seed, steps, processing_ms.
    """
    if seed is None:
        seed = random.randint(0, config.MAX_SEED)

    if config.IMAGE_GEN_MODE == "api":
        return _generate_api(
            prompt=prompt,
            width=width,
            height=height,
            image_format=image_format,
            seed=seed,
        )

    steps = num_inference_steps or config.NUM_INFERENCE_STEPS
    scale = guidance_scale or config.GUIDANCE_SCALE
    return _generate_local(
        prompt=prompt,
        width=width,
        height=height,
        image_format=image_format,
        seed=seed,
        steps=steps,
        scale=scale,
    )
