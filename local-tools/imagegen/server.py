# Servizio LOCALE di generazione icone item per TenpennyNovels (fork di
# cthulhucardgame/tools/imagegen, adattato per icone a colori invece che
# illustrazioni di carte in bianco e nero).
#
# Il server carica UN SOLO modello per avvio (env IMAGEGEN_MODEL) e riconosce se è
# FLUX o SDXL/SD, configurando pipeline, scheduler ed (eventuale) LoRA di conseguenza.
# Espone sia txt2img (usato da generate_items.py) sia img2img (non usato dalla
# pipeline item attuale, tenuto per eventuali refinement futuri).
#
# Contratto HTTP (usato da generate_items.py):
#   POST /txt2img  {prompt, negative_prompt?, steps?, guidance?, seed?, width?, height?}      → image/png
#   POST /img2img  {prompt, image(base64), strength?, negative_prompt?, steps?, guidance?...} → image/png
#   GET  /health   → info modello/tipo/lora/scheduler/device
#
# Variabili ambiente:
#   IMAGEGEN_MODEL         modello base (default SD1.5 — vedi nota sotto). Es. stabilityai/stable-diffusion-xl-base-1.0
#   IMAGEGEN_LORA          repo/percorso LoRA (solo SDXL/SD, applicato allo step 2)
#   IMAGEGEN_LORA_SCALE    peso LoRA (default 0.8)
#   IMAGEGEN_DEVICE        forza cuda|mps|cpu
#   IMAGEGEN_CPU_OFFLOAD   =1 abilita sequential CPU offload (utile per FLUX su poca memoria)
#
# Avvio:  bash run.sh

import base64
import io
import os

import torch
from fastapi import FastAPI, HTTPException, Response
from PIL import Image
from pydantic import BaseModel

# NOTA: default SD1.5, non SDXL. Verificato empiricamente (vedi git log): SDXL su
# MPS con bf16+upcast_vae produce artefatti di corruzione a strisce/griglia in
# modo intermittente e dipendente dal seed (stesso bug "immagini nere" della
# card-game version, ma manifestato come rumore invece che nero puro — il check
# anti-nero non lo intercetta). SD1.5 in fp32 puro, senza VAE tiling, è stabile
# (confermato anche in thekeeperarchive/poc/imagegen che usa la stessa identica
# configurazione). Override con IMAGEGEN_MODEL se si vuole comunque provare SDXL.
MODEL_ID = os.environ.get("IMAGEGEN_MODEL", "runwayml/stable-diffusion-v1-5")
LORA_ID = os.environ.get("IMAGEGEN_LORA", "").strip()
LORA_SCALE = float(os.environ.get("IMAGEGEN_LORA_SCALE", "0.8"))
CPU_OFFLOAD = os.environ.get("IMAGEGEN_CPU_OFFLOAD", "") == "1"

IS_FLUX = "flux" in MODEL_ID.lower()


def pick_device() -> str:
    forced = os.environ.get("IMAGEGEN_DEVICE")
    if forced:
        return forced
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


DEVICE = pick_device()
# dtype: override esplicito via env (IMAGEGEN_DTYPE=fp16|bf16|fp32), utile per far
# stare SDXL nella memoria su Apple Silicon (fp16 dimezza l'uso e riduce lo swap).
_DTYPE_MAP = {
    "fp16": torch.float16, "float16": torch.float16,
    "bf16": torch.bfloat16, "bfloat16": torch.bfloat16,
    "fp32": torch.float32, "float32": torch.float32,
}
_dtype_env = os.environ.get("IMAGEGEN_DTYPE", "").lower()
_IS_XL = "xl" in MODEL_ID.lower()
if _dtype_env in _DTYPE_MAP:
    DTYPE = _DTYPE_MAP[_dtype_env]
elif IS_FLUX:
    DTYPE = torch.bfloat16 if DEVICE in ("cuda", "mps") else torch.float32
elif DEVICE == "cuda":
    DTYPE = torch.float16
elif DEVICE == "mps" and _IS_XL:
    # SDXL fp16 su MPS = immagini nere (NaN); fp32 swappa su 16GB. bf16 è il compromesso.
    DTYPE = torch.bfloat16
else:
    DTYPE = torch.float32  # SD 1.5 su MPS/CPU va bene in fp32

lora_loaded = False
scheduler_name = "default"

print(f"[imagegen] carico {MODEL_ID} — tipo={'flux' if IS_FLUX else 'sdxl/sd'} "
      f"device={DEVICE} dtype={DTYPE} …", flush=True)

if IS_FLUX:
    from diffusers import FluxImg2ImgPipeline, FluxPipeline

    txt2img = FluxPipeline.from_pretrained(MODEL_ID, torch_dtype=DTYPE)
    img2img = FluxImg2ImgPipeline.from_pipe(txt2img)
    scheduler_name = type(txt2img.scheduler).__name__
else:
    from diffusers import (
        AutoPipelineForImage2Image,
        AutoPipelineForText2Image,
        DPMSolverMultistepScheduler,
    )

    # SD 1.5 ha un safety checker che annerisce i temi horror: va disattivato.
    # SDXL non ha quel parametro, quindi lo passiamo solo ai modelli non-XL.
    load_kwargs = {"torch_dtype": DTYPE}
    if "xl" not in MODEL_ID.lower():
        load_kwargs.update(safety_checker=None, requires_safety_checker=False)

    txt2img = AutoPipelineForText2Image.from_pretrained(MODEL_ID, **load_kwargs)
    # Scheduler DPM++ 2M Karras: ~30 step di qualità (batte il PNDM di default).
    txt2img.scheduler = DPMSolverMultistepScheduler.from_config(
        txt2img.scheduler.config, use_karras_sigmas=True, algorithm_type="dpmsolver++"
    )
    scheduler_name = "DPMSolverMultistep (Karras)"
    img2img = AutoPipelineForImage2Image.from_pipe(txt2img)

    if LORA_ID:
        try:
            txt2img.load_lora_weights(LORA_ID)  # condiviso anche con img2img (from_pipe)
            lora_loaded = True
            print(f"[imagegen] LoRA caricato: {LORA_ID} (scale {LORA_SCALE})", flush=True)
        except Exception as e:  # noqa: BLE001 — fallback prompt-only, non fatale
            print(f"[imagegen] ⚠️  LoRA non caricato ({LORA_ID}): {e} — proseguo prompt-only", flush=True)

# Ottimizzazioni memoria (soprattutto MPS / FLUX)
if CPU_OFFLOAD:
    try:
        txt2img.enable_sequential_cpu_offload()
    except Exception:
        pass
else:
    txt2img = txt2img.to(DEVICE)
    img2img = img2img.to(DEVICE)

# SDXL in fp16/bf16 su MPS produce immagini NERE (NaN nel decode del VAE) in modo
# intermittente: il VAE va tenuto in fp32 SEMPRE su MPS. upcast_vae() lo fa; il VAE è
# condiviso da txt2img e img2img (from_pipe).
if not IS_FLUX and _IS_XL and DEVICE == "mps" and DTYPE != torch.float32:
    try:
        txt2img.upcast_vae()
        print("[imagegen] VAE SDXL portato a fp32 (fix immagini nere su MPS)", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"[imagegen] ⚠️  upcast_vae fallito: {e}", flush=True)

for p in (txt2img, img2img):
    try:
        p.enable_attention_slicing()
    except Exception:
        pass
    # NOTA: enable_vae_tiling() rimosso — serve solo per immagini grandi che non
    # entrano in memoria. Per le icone item (400x400, macchina con RAM abbondante)
    # è inutile e sospettato causare gli artefatti a strisce/griglia osservati su
    # MPS (probabile disallineamento tra i tile del VAE, aggravato dall'upcast a
    # fp32). Se in futuro si generano immagini molto più grandi, valutare se
    # riabilitarla con soglia dimensionale.

print("[imagegen] pronto.", flush=True)

app = FastAPI(title="imagegen — pipeline 2-pass (FLUX/SDXL)")

# NOTA: a differenza dell'originale (stile carte B/N), qui NON escludiamo "color" —
# le icone item vanno a colori. Esclusione forte di frame/collage/più oggetti: SDXL
# base tende a comporre "tavole illustrative" con cornici ornamentali e più varianti
# dello stesso oggetto se non lo si vieta esplicitamente.
# NOTA: tenuto corto di proposito. Una lista negativa lunga (provato: ~30 termini)
# dilude l'attenzione del modello tanto quanto un prompt positivo lungo, e non
# ha impedito comunque cornici/collage — quello che ha funzionato è stato
# accorciare ENTRAMBI i prompt, non allungare il negativo.
DEFAULT_NEG = ("cartoon, flat colors, vector art, anime, comic, sticker, "
               "text, watermark, frame, border, blurry, low quality, deformed")


class Txt2ImgRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    steps: int = 30
    guidance: float = 6.5
    seed: int = 0
    width: int = 1024
    height: int = 768


class Img2ImgRequest(BaseModel):
    prompt: str
    image: str  # PNG in base64
    strength: float = 0.5
    negative_prompt: str = ""
    steps: int = 30
    guidance: float = 6.5
    seed: int = 0


def _round8(x: int) -> int:
    """Le pipeline richiedono dimensioni multiple di 8."""
    return max(256, (int(x) // 8) * 8)


def _gen(seed: int):
    return torch.Generator(device="cpu").manual_seed(int(seed))


def _to_png(image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_ID,
        "type": "flux" if IS_FLUX else "sdxl/sd",
        "lora": LORA_ID or None,
        "lora_loaded": lora_loaded,
        "scheduler": scheduler_name,
        "device": DEVICE,
    }


@app.post("/txt2img")
def txt2img_endpoint(req: Txt2ImgRequest):
    width, height = _round8(req.width), _round8(req.height)
    steps = max(1, min(100, int(req.steps)))
    guidance = max(0.0, min(20.0, float(req.guidance)))
    try:
        if IS_FLUX:
            image = txt2img(
                prompt=req.prompt,
                num_inference_steps=steps,
                guidance_scale=guidance,  # schnell: passare 0.0 dal driver
                width=width,
                height=height,
                generator=_gen(req.seed),
                max_sequence_length=512,
            ).images[0]
        else:
            image = txt2img(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or DEFAULT_NEG,
                num_inference_steps=steps,
                guidance_scale=guidance,
                width=width,
                height=height,
                generator=_gen(req.seed),
            ).images[0]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return Response(content=_to_png(image), media_type="image/png")


@app.post("/img2img")
def img2img_endpoint(req: Img2ImgRequest):
    steps = max(1, min(100, int(req.steps)))
    guidance = max(0.0, min(20.0, float(req.guidance)))
    strength = max(0.05, min(1.0, float(req.strength)))
    try:
        init = Image.open(io.BytesIO(base64.b64decode(req.image))).convert("RGB")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"immagine non valida: {e}")
    try:
        if IS_FLUX:
            image = img2img(
                prompt=req.prompt,
                image=init,
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=_gen(req.seed),
                max_sequence_length=512,
            ).images[0]
        else:
            kwargs = {}
            if lora_loaded:
                kwargs["cross_attention_kwargs"] = {"scale": LORA_SCALE}
            image = img2img(
                prompt=req.prompt,
                image=init,
                strength=strength,
                negative_prompt=req.negative_prompt or DEFAULT_NEG,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=_gen(req.seed),
                **kwargs,
            ).images[0]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return Response(content=_to_png(image), media_type="image/png")
