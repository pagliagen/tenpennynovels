import os

# "local" = run model on device (MPS/CUDA/CPU), "api" = call Stability AI REST API
IMAGE_GEN_MODE = os.getenv("IMAGE_GEN_MODE", "local")

# --- Local mode settings ---
MODEL_ID = os.getenv("IMAGE_GEN_MODEL_ID", "stable-diffusion-v1-5/stable-diffusion-v1-5")
NUM_INFERENCE_STEPS = int(os.getenv("IMAGE_GEN_STEPS", "30"))
GUIDANCE_SCALE = float(os.getenv("IMAGE_GEN_GUIDANCE_SCALE", "7.5"))
DEFAULT_WIDTH = int(os.getenv("IMAGE_GEN_WIDTH", "512"))
DEFAULT_HEIGHT = int(os.getenv("IMAGE_GEN_HEIGHT", "512"))
DEFAULT_FORMAT = os.getenv("IMAGE_GEN_FORMAT", "png")
MAX_SEED = 2**32 - 1
HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN", "")

# --- API mode settings (Stability AI) ---
STABILITY_API_KEY = os.getenv("STABILITY_API_KEY", "")
STABILITY_MODEL = os.getenv("STABILITY_MODEL", "sd3.5-large-turbo")
STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image/generate/sd3"

# --- Server ---
PORT = int(os.getenv("IMAGE_GEN_PORT", "8100"))
HOST = os.getenv("IMAGE_GEN_HOST", "0.0.0.0")
