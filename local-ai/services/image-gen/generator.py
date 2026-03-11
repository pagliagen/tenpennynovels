"""
Image generation pipeline.
Loads the model once at startup and keeps it in memory.
In production (CUDA), SDXL or FLUX can be used.
In dev on Apple Silicon (MPS), SD 1.5 is used for compatibility.
"""

import io
import base64
import logging
import random
import time

import torch
from PIL import Image

import config

logger = logging.getLogger("image-gen.generator")

_pipe = None


def _resolve_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_model() -> None:
    """Load the image generation pipeline into memory. Called once at startup."""
    global _pipe

    from diffusers import AutoPipelineForText2Image

    device = _resolve_device()

    # MPS (Apple Silicon) produces NaN with float16. SD 1.5 is small enough
    # for float32 (~8GB). CUDA can use float16 safely.
    if device == "cuda":
        dtype = torch.float16
    else:
        dtype = torch.float32

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
    Returns dict with base64, format, width, height, seed, steps, processing_ms.
    """
    if _pipe is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    if seed is None:
        seed = random.randint(0, config.MAX_SEED)
    steps = num_inference_steps or config.NUM_INFERENCE_STEPS
    scale = guidance_scale or config.GUIDANCE_SCALE

    generator = torch.Generator(device="cpu").manual_seed(seed)

    logger.info(f"Generating: {width}x{height}, steps={steps}, seed={seed}")
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
    pil_format = {"png": "PNG", "jpeg": "JPEG", "webp": "WEBP"}.get(image_format, "WEBP")
    image.save(buf, format=pil_format)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    logger.info(f"Generated in {processing_ms}ms, size={len(buf.getvalue())} bytes")

    return {
        "base64": b64,
        "format": image_format,
        "width": width,
        "height": height,
        "seed": seed,
        "steps": steps,
        "processing_ms": processing_ms,
    }
