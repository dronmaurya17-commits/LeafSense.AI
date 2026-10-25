# LeafSense.AI

Upload a leaf photo, get a prediction from a **real, locally running** plant-disease
classifier. React + Vite frontend (port 3000) → small FastAPI service (port 8000) →
ONNX Runtime CPU inference. No cloud, no API keys, no GPU, no database.

## The model (verified before use)

`backend/model/plant_disease.onnx` — an ONNX export of
**[neghani/plantvillage-mobilenetv2](https://huggingface.co/neghani/plantvillage-mobilenetv2)**
(MobileNetV2 fine-tuned on PlantVillage). Upstream license **Apache-2.0**; see
`backend/model/NOTICE.md` for source/attribution. Input: RGB 224×224, resize shortest
edge to 256, bilinear, center crop, scale 1/255, normalize mean/std 0.5. Output: 38 logits →
softmax confidence. The ONNX graph was inspected (38 outputs) and smoke-tested locally
against 10 labeled PlantVillage photos (10/10 top-1 correct).

The model's **38 real labels** are in `backend/model/labels.json` — 14 crops
(Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Bell pepper, Potato, Raspberry,
Soybean, Squash, Strawberry, Tomato) × healthy/disease states. The label encodes the plant,
so the app shows the plant name.

### Mapping to the four requested categories

| Target | Genuinely supported by real model classes? |
|---|---|
| **Spotted Leaf** | Yes — Bacterial spot (Peach, Bell pepper, Tomato), Cercospora/Gray leaf spot (Corn), Isariopsis leaf spot (Grape), Septoria leaf spot (Tomato), Target spot (Tomato). |
| **Rust** | Yes — Cedar apple rust (Apple), Common rust (Corn). |
| **Powdery Mildew** | Yes — Cherry (including sour), Squash. |
| **Gray Mold** | **No.** PlantVillage has no Botrytis / gray mold class. |

Plant-specific class names are always preserved in the result. Classes that are not one
of the 11 above (healthy leaves, blights, viruses, rots, mite damage, leaf scorch, etc.)
are reported honestly as **"Outside the four target categories"** — never forced into a
target label. Corn "Gray leaf spot" is *Cercospora*, a leaf spot; it is **not** gray mold.

**Smallest next step for Gray Mold:** fine-tune the same backbone on a small, labeled
Botrytis cinerea image set (e.g. PlantDoc / a Botrytis dataset) and add those labels to
`labels.json` + `CLASS_TO_CATEGORY`. That is a training task and is out of scope for this MVP.

## Important limitations

- Top-1 softmax probability below **0.50** → the app refuses to diagnose ("Uncertain"),
  following the upstream model card's recommendation. Confidence is a model score, not
  proof of correct diagnosis.
- PlantVillage photos are single leaves on plain lab backgrounds (~99% on its own test
  split). The upstream card reports only ~16% end-to-end on real field photos, so phone
  pictures in a garden will often be wrong or uncertain.
- The model can only output one of its 38 classes. Non-leaf photos, other crops, other
  diseases and nutrient problems get pushed into the nearest known class — treat such
  results with suspicion.
- Educational use only; consult a local plant expert before any treatment.

## Install and run (Windows, two terminals)

Python 3.10–3.12 and Node.js 18+ are required.

**Terminal 1 — backend:**
```bat
cd LeafSense.AI
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r backend\requirements.txt
python -m uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000
```

**Terminal 2 — frontend:**
```bat
cd LeafSense.AI\frontend
npm install
npm run dev
```

Open **http://localhost:3000**. The Vite dev server proxies `/api` to the backend on
port 8000, so the browser only ever talks to port 3000.

Check the backend alone: `curl http://localhost:8000/api/health`.

## Files

```
backend/app.py               FastAPI: /api/health, /api/predict (real preprocessing + inference)
backend/requirements.txt     fastapi, uvicorn, onnxruntime, numpy, pillow
backend/model/               plant_disease.onnx, labels.json, NOTICE.md
frontend/                    React + Vite app (port 3000), proxy configured in vite.config.js
```
