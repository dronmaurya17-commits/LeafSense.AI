"""LeafSense.AI - local CPU inference API.

Serves a real, pretrained PlantVillage classifier (ONNX, 38 classes).
No network calls, no API keys, no training. Predictions come only from the model.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
MODEL_FILE = ROOT / "model" / "plant_disease.onnx"
LABELS_FILE = ROOT / "model" / "labels.json"

MODEL_NAME = "neghani/plantvillage-mobilenetv2 (MobileNetV2, ONNX export, 38 PlantVillage classes)"
MAX_BYTES = 10 * 1024 * 1024
VALID_FORMATS = {"JPEG", "PNG", "WEBP"}
CONFIDENCE_THRESHOLD = 0.50  # recommended by the upstream model card
INPUT_SIZE = 224
RESIZE_SHORT_EDGE = 256
MEAN = np.array([0.5, 0.5, 0.5], dtype=np.float32)
STD = np.array([0.5, 0.5, 0.5], dtype=np.float32)

# Only classes whose real disease name is a leaf spot, a rust, or powdery mildew
# are mapped to our four target categories. Nothing else is relabelled.
# "Gray Mold" (Botrytis cinerea) has NO class in PlantVillage and stays unsupported.
# Note: Corn "Gray leaf spot" is Cercospora, a leaf spot - NOT gray mold.
SPOTTED_LEAF = "Spotted Leaf"
RUST = "Rust"
POWDERY_MILDEW = "Powdery Mildew"
GRAY_MOLD = "Gray Mold"

CATEGORY_INFO = {
    SPOTTED_LEAF: {
        "symptoms": "Small dark, brown or grey spots on the leaf, often with a yellow halo. Spots can merge and leaves may yellow or drop early.",
        "care": [
            "Remove and discard badly affected leaves; do not compost them.",
            "Water at the base and avoid wetting foliage, especially in the evening.",
            "Improve air circulation and avoid crowding plants.",
            "Ask a local plant clinic or extension service before applying any treatment.",
        ],
    },
    RUST: {
        "symptoms": "Orange, yellow or rusty-brown powdery pustules, usually on the underside of leaves, with yellow patches on the upper surface.",
        "care": [
            "Remove infected leaves and clean up fallen plant debris.",
            "Keep leaves dry and space plants so air can move freely.",
            "Check nearby plants, as rust spreads easily in humid weather.",
            "Confirm any fungicide choice with a local agricultural expert.",
        ],
    },
    POWDERY_MILDEW: {
        "symptoms": "A white to grey powdery coating on leaves and stems; leaves may curl, yellow or become distorted.",
        "care": [
            "Move the plant into better airflow and more sunlight where possible.",
            "Avoid overhead watering late in the day and avoid excess nitrogen fertiliser.",
            "Prune heavily infected growth and dispose of it away from other plants.",
            "Ask a local expert about approved treatments for your crop.",
        ],
    },
}

CLASS_TO_CATEGORY = {
    # Leaf spot diseases (bacterial / fungal spots) -> "Spotted Leaf"
    "Peach___Bacterial_spot": SPOTTED_LEAF,
    "Pepper,_bell___Bacterial_spot": SPOTTED_LEAF,
    "Tomato___Bacterial_spot": SPOTTED_LEAF,
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": SPOTTED_LEAF,
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": SPOTTED_LEAF,
    "Tomato___Septoria_leaf_spot": SPOTTED_LEAF,
    "Tomato___Target_Spot": SPOTTED_LEAF,
    # True rust diseases -> "Rust"
    "Apple___Cedar_apple_rust": RUST,
    "Corn_(maize)___Common_rust_": RUST,
    # True powdery mildew -> "Powdery Mildew"
    "Cherry_(including_sour)___Powdery_mildew": POWDERY_MILDEW,
    "Squash___Powdery_mildew": POWDERY_MILDEW,
}

PLANT_NAMES = {
    "Apple": "Apple",
    "Blueberry": "Blueberry",
    "Cherry_(including_sour)": "Cherry (including sour)",
    "Corn_(maize)": "Corn (maize)",
    "Grape": "Grape",
    "Orange": "Orange",
    "Peach": "Peach",
    "Pepper,_bell": "Bell pepper",
    "Potato": "Potato",
    "Raspberry": "Raspberry",
    "Soybean": "Soybean",
    "Squash": "Squash",
    "Strawberry": "Strawberry",
    "Tomato": "Tomato",
}

SUPPORTED_TARGETS = [SPOTTED_LEAF, RUST, POWDERY_MILDEW]
UNSUPPORTED_TARGETS = [GRAY_MOLD]

app = FastAPI(title="LeafSense.AI inference", version="1.0.0")

_session = None
_input_name = None
_labels = []
_model_error = None

try:
    _labels = json.loads(LABELS_FILE.read_text(encoding="utf-8"))
    _session = ort.InferenceSession(str(MODEL_FILE), providers=["CPUExecutionProvider"])
    _input_name = _session.get_inputs()[0].name
    out_dim = _session.get_outputs()[0].shape[-1]
    if not isinstance(out_dim, int) or out_dim != len(_labels):
        raise RuntimeError(
            f"model outputs {out_dim} classes but labels.json lists {len(_labels)}"
        )
except Exception as exc:  # keep the API alive so the UI can show a clear error
    _session = None
    _model_error = f"{type(exc).__name__}: {exc}"


def _prettify(token: str) -> str:
    return " ".join(token.replace("_", " ").replace(",", " ").split())


def _describe(raw_label: str) -> tuple[str, str]:
    plant_raw, _, condition_raw = raw_label.partition("___")
    plant = PLANT_NAMES.get(plant_raw, _prettify(plant_raw))
    return plant, _prettify(condition_raw)


def _preprocess(payload: bytes) -> np.ndarray:
    if not payload:
        raise ValueError("No image data was received.")
    if len(payload) > MAX_BYTES:
        raise ValueError("Image is larger than the 10 MB limit.")

    image = Image.open(io.BytesIO(payload))
    fmt = (image.format or "").upper()
    if fmt not in VALID_FORMATS:
        raise ValueError("Only JPG, JPEG, PNG and WEBP images are supported.")
    width, height = image.size
    if min(width, height) < 32 or max(width, height) > 8000:
        raise ValueError("Image dimensions are not usable. Please choose a clear leaf photo.")
    image.load()  # force full decode so truncated/corrupt files fail here
    image = ImageOps.exif_transpose(image).convert("RGB")

    scale = RESIZE_SHORT_EDGE / min(width, height)
    new_w = max(INPUT_SIZE, round(width * scale))
    new_h = max(INPUT_SIZE, round(height * scale))
    image = image.resize((new_w, new_h), Image.Resampling.BILINEAR)
    left = (new_w - INPUT_SIZE) // 2
    top = (new_h - INPUT_SIZE) // 2
    image = image.crop((left, top, left + INPUT_SIZE, top + INPUT_SIZE))

    x = np.asarray(image, dtype=np.float32) / 255.0
    x = (x - MEAN) / STD
    x = np.transpose(x, (2, 0, 1))[None].astype(np.float32)
    return np.ascontiguousarray(x)


@app.get("/api/health")
def health():
    return {
        "ok": _session is not None,
        "model_loaded": _session is not None,
        "model": MODEL_NAME,
        "classes": len(_labels),
        "supported_targets": SUPPORTED_TARGETS,
        "unsupported_targets": UNSUPPORTED_TARGETS,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "error": _model_error,
    }


@app.post("/api/predict")
async def predict(request: Request):
    if _session is None:
        return JSONResponse(
            status_code=503,
            content={"error": f"Local model is unavailable. {_model_error or ''}".strip()},
        )

    try:
        payload = bytearray()
        async for chunk in request.stream():
            if len(payload) + len(chunk) > MAX_BYTES:
                raise ValueError("Image is larger than the 10 MB limit.")
            payload.extend(chunk)
        tensor = _preprocess(bytes(payload))
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "This file could not be read as a valid JPG, PNG or WEBP image."},
        )

    try:
        logits = _session.run(None, {_input_name: tensor})[0][0]
        exp = np.exp(logits - np.max(logits))
        probabilities = exp / exp.sum()
        index = int(np.argmax(probabilities))
        confidence = float(probabilities[index])
        raw_label = _labels[index]
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": f"Local inference failed: {type(exc).__name__}: {exc}"},
        )

    plant, condition = _describe(raw_label)
    category = CLASS_TO_CATEGORY.get(raw_label)

    response = {
        "model": MODEL_NAME,
        "raw_label": raw_label,
        "plant": plant,
        "condition": condition,
        "confidence": confidence,
        "threshold": CONFIDENCE_THRESHOLD,
        "category": None,
        "symptoms": None,
        "care": [],
        "message": None,
    }

    if confidence < CONFIDENCE_THRESHOLD:
        response["status"] = "uncertain"
        response["message"] = (
            "The model is not confident enough to identify a disease in this photo. "
            "Retake the image with one leaf, in focus, in daylight on a plain background."
        )
        return response

    if category is None:
        response["status"] = "out_of_scope"
        response["message"] = (
            "This looks like an unhealthy or healthy leaf outside LeafSense.AI's four "
            "target categories. The model's own class is shown below; no target disease "
            "diagnosis is provided for it."
        )
        return response

    response["status"] = "ok"
    response["category"] = category
    response["symptoms"] = CATEGORY_INFO[category]["symptoms"]
    response["care"] = CATEGORY_INFO[category]["care"]
    response["message"] = (
        f"Matched to the broad target category '{category}' from the model's "
        f"plant-specific class '{plant} - {condition}'."
    )
    return response
