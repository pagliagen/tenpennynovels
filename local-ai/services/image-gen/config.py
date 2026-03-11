import os

MODEL_ID = os.getenv("IMAGE_GEN_MODEL_ID", "stable-diffusion-v1-5/stable-diffusion-v1-5")
NUM_INFERENCE_STEPS = int(os.getenv("IMAGE_GEN_STEPS", "30"))
GUIDANCE_SCALE = float(os.getenv("IMAGE_GEN_GUIDANCE_SCALE", "7.5"))
DEFAULT_WIDTH = int(os.getenv("IMAGE_GEN_WIDTH", "1024"))
DEFAULT_HEIGHT = int(os.getenv("IMAGE_GEN_HEIGHT", "1024"))
DEFAULT_FORMAT = os.getenv("IMAGE_GEN_FORMAT", "webp")
MAX_SEED = 2**32 - 1
IMAGE_GEN_SEED=42

PORT = int(os.getenv("IMAGE_GEN_PORT", "8100"))
HOST = os.getenv("IMAGE_GEN_HOST", "0.0.0.0")

HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN", "")
