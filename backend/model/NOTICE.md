# Model notice

`plant_disease.onnx` (9.2 MB) is an ONNX export of the pretrained classifier
**neghani/plantvillage-mobilenetv2** (MobileNetV2 fine-tuned on PlantVillage,
38 classes, 224x224 RGB input, logits output). The upstream model is published
under **Apache-2.0**: https://huggingface.co/neghani/plantvillage-mobilenetv2

The ONNX file was obtained from a public mirror of that model:
https://github.com/AkankshaBhosale08/ai-plant-doctor/tree/main/model
(with `preprocess.json` declaring source `neghani/plantvillage-mobilenetv2@v1.0`).
`labels.json` is the ordered 38-class list from that mirror, matching the
alphabetical PlantVillage class folders and the upstream model card.

Apache-2.0 license text: https://www.apache.org/licenses/LICENSE-2.0

Training data: PlantVillage (Hughes & Salathe; Mohanty et al., 2016).
Inference runtime: ONNX Runtime (MIT), CPU only.

The ONNX graph was verified locally: input `pixel_values` [batch,3,224,224]
float32, output `logits` [batch,38]. It classified 10/10 labeled PlantVillage
sample photos (rust, powdery mildew, leaf spots, healthy, blight) correctly in
a local smoke test. No weights were trained or modified for this project.
