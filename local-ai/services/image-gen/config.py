import os

MODEL_ID = os.getenv("IMAGE_GEN_MODEL_ID", os.getenv("FLUX_MODEL_ID", "stable-diffusion-v1-5/stable-diffusion-v1-5"))
NUM_INFERENCE_STEPS = int(os.getenv("IMAGE_GEN_STEPS", os.getenv("FLUX_STEPS", "60")))
GUIDANCE_SCALE = float(os.getenv("IMAGE_GEN_GUIDANCE_SCALE", os.getenv("FLUX_GUIDANCE_SCALE", "8.5")))
DEFAULT_WIDTH = int(os.getenv("FLUX_DEFAULT_WIDTH", "256"))
DEFAULT_HEIGHT = int(os.getenv("FLUX_DEFAULT_HEIGHT", "256"))
DEFAULT_FORMAT = os.getenv("FLUX_DEFAULT_FORMAT", "png")
MAX_SEED = 2**32 - 1

PORT = int(os.getenv("IMAGE_GEN_PORT", "8100"))
HOST = os.getenv("IMAGE_GEN_HOST", "0.0.0.0")

HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN", "")
