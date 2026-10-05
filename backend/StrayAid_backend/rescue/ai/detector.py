"""Animal detector for report photos (spec section 4, Stitch screen 11).

A pretrained COCO object detector, SSD-MobileNet v1 from the ONNX Model Zoo (Apache-2.0),
run on the server's CPU with onnxruntime. No hosted AI API and nothing to pay for.

The model file is not kept in git: `python manage.py download_ai_model` fetches it into
AI_MODEL_PATH. Without it, detection returns None and reports are simply left unscored.
"""

import logging
import threading

import numpy as np
from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MODEL_NAME = "SSD-MobileNet v1 (COCO)"
MODEL_URL = (
    "https://github.com/onnx/models/raw/main/validated/vision/object_detection_segmentation/"
    "ssd-mobilenetv1/model/ssd_mobilenet_v1_12.onnx"
)
MODEL_SHA256 = "b8fba5e404077d4048d27fcd1667e85e27e192eb9bf51e696c46a3acd7d21058"

# COCO class ids (TensorFlow's 1-based numbering) for animals people report as strays.
ANIMAL_CLASSES = {16: "bird", 17: "cat", 18: "dog", 19: "horse", 20: "sheep", 21: "cow"}
# Photos are shrunk before detection; the model works at 300x300 internally anyway.
MAX_SIDE = 640

_session = None
_session_lock = threading.Lock()
_unavailable = False


def _get_session():
    """Load the model once per process. Returns None if it can't be loaded."""
    global _session, _unavailable
    if _session is not None or _unavailable:
        return _session
    with _session_lock:
        if _session is None and not _unavailable:
            try:
                import onnxruntime

                _session = onnxruntime.InferenceSession(
                    str(settings.AI_MODEL_PATH), providers=["CPUExecutionProvider"]
                )
            except Exception as error:  # missing file, missing package, corrupt model
                logger.warning("AI detector unavailable, reports won't be scored: %s", error)
                _unavailable = True
    return _session


def is_ready():
    """True once the model is loaded, so detection takes ~50 ms instead of the first load's ~12 s."""
    return _session is not None


def warm_up():
    """Load the model in a background thread when the server starts."""
    threading.Thread(target=_get_session, name="ai-detector-warm-up", daemon=True).start()


def detect_animal(image_file):
    """Find the most likely animal in a photo.

    Returns {"confidence": 0-1, "label": "dog", "box": [x0, y0, x1, y1]} with the box in
    0-1 image coordinates, {"confidence": 0.0, "label": "", "box": None} if no animal was
    found, or None if the detector isn't available.
    """
    session = _get_session()
    if session is None:
        return None

    try:
        image_file.seek(0)
        image = ImageOps.exif_transpose(Image.open(image_file)).convert("RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        boxes, classes, scores, _ = session.run(None, {"inputs": np.asarray(image, dtype=np.uint8)[None]})
    except Exception as error:
        logger.warning("AI detection failed: %s", error)
        return None
    finally:
        try:
            image_file.seek(0)
        except Exception:
            pass

    best = {"confidence": 0.0, "label": "", "box": None}
    for box, class_id, score in zip(boxes[0], classes[0], scores[0]):
        label = ANIMAL_CLASSES.get(int(class_id))
        if label and float(score) > best["confidence"]:
            y0, x0, y1, x1 = (round(float(value), 4) for value in box)
            best = {"confidence": round(float(score), 4), "label": label, "box": [x0, y0, x1, y1]}
    return best
