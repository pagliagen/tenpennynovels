"""
Hardcoded prompt templates for image generation.
Each builder extracts relevant fields from the record dict and produces
a Stable-Diffusion / FLUX-friendly English prompt string.
"""

from typing import Any

STYLE_SUFFIXES: dict[str, str] = {
    "portrait": "oil painting portrait style, classical, museum quality",
    "photorealistic": "photorealistic, highly detailed photograph, studio lighting",
    "illustrated": "detailed illustration, pen and ink with watercolor wash",
    "noir": "black and white noir sketch, high contrast, dramatic shadows",
    "realistic": "highly detailed realistic illustration, victorian engraving style",
    "sketch": "pencil sketch on aged paper, fine crosshatching",
    "icon": "game inventory icon, clean edges, slight drop shadow, transparent background",
    "atmospheric": "atmospheric oil painting, moody lighting, cinematic composition",
    "watercolor": "watercolor painting, soft edges, muted palette",
}

DEFAULT_STYLE = "photorealistic, highly detailed"


def _style(style: str | None) -> str:
    if not style:
        return DEFAULT_STYLE
    return STYLE_SUFFIXES.get(style, style)


def build_character_prompt(record: dict[str, Any], style: str | None = None) -> str:
    name = record.get("name", "unknown person")
    gender = record.get("gender", "person")
    gender_word = "man" if gender == "male" else "woman"
    age = record.get("apparentAge") or record.get("age", "")
    phys = record.get("physicalDescription", "")

    eye_color = record.get("eyeColor", "")
    hair_color = record.get("hairColor", "")

    details: list[str] = []
    if age:
        details.append(f"approximately {age} years old")
    if phys:
        details.append(phys)
    if eye_color:
        details.append(f"{eye_color} eyes")
    if hair_color:
        details.append(f"{hair_color} hair")

    detail_str = ", ".join(details) if details else ""

    return (
        f"1920s head-and-shoulders portrait of a {gender_word} named {name}, "
        f"{detail_str}, "
        f"Victorian London setting, period-appropriate clothing and grooming, "
        f"neutral studio background, {_style(style)}"
    )


def build_item_prompt(record: dict[str, Any], style: str | None = None) -> str:
    name = record.get("name", "mysterious object")
    description = record.get("description", "")
    category = record.get("category", "")
    subcategory = record.get("subcategory", "")

    cat_hint = f"{subcategory} {category}".strip() if (category or subcategory) else ""

    return (
        f"Single object product photograph of a Victorian-era {cat_hint} named \"{name}\". "
        f"{description}. Authentic late-19th-century London antique. "
        f"Centered composition, isolated on plain neutral background, "
        f"museum catalog style product shot, soft studio lighting, "
        f"photorealistic, ultra detailed metal textures, sharp focus, "
        f"no people, no environment, minimal shadow"
    )


def build_location_prompt(record: dict[str, Any], style: str | None = None) -> str:
    name = record.get("name", "unknown place")
    description = record.get("description", "")
    district = record.get("district", "")

    district_hint = f"in the {district} district" if district else ""

    return (
        f"Wide establishing shot of \"{name}\" {district_hint}, "
        f"{description}, "
        f"1920s London atmosphere, gaslit streets, period architecture, "
        f"cinematic 16:9 composition, {_style(style)}"
    )


PROMPT_BUILDERS: dict[str, callable] = {
    "character": build_character_prompt,
    "item": build_item_prompt,
    "location": build_location_prompt,
}


def build_prompt(entity_type: str, record: dict[str, Any], style: str | None = None) -> str:
    builder = PROMPT_BUILDERS.get(entity_type)
    if builder is None:
        raise ValueError(f"Unknown entity type: {entity_type}")
    return builder(record, style)
