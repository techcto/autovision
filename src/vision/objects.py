"""In-process OpenCV 5 COCO-80 object detection with a checksum-verified YOLOX model.

The standard vision image provisions pinned OpenCV Zoo weights at build time;
runtime never downloads weights. Scores are detector scores, not calibrated
probabilities. Pre- and post-processing follow the OpenCV Zoo YOLOX reference.
"""
import hashlib
import os
from pathlib import Path
import threading
import cv2
import numpy as np
from install_face_models import REVISION

CLASSES = ('person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
           'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
           'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
           'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
           'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
           'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
           'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
           'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors',
           'teddy bear', 'hair drier', 'toothbrush')
INPUT_SIZE = 640
SCORE_THRESHOLD = 0.5
NMS_THRESHOLD = 0.5
MAX_DETECTIONS = 20

_lock = threading.Lock()
_model = None


class ObjectModelUnavailable(RuntimeError):
    pass


def model():
    global _model
    if _model is not None:
        return _model
    path = os.environ.get('AUTOVISION_YOLOX_MODEL', '')
    expected = os.environ.get('AUTOVISION_YOLOX_SHA256', '')
    if not path or len(expected) != 64 or not Path(path).is_file():
        raise ObjectModelUnavailable('Object detection model is not configured')
    actual = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if actual != expected.lower():
        raise ObjectModelUnavailable('Object detection model checksum mismatch')
    try:
        net = cv2.dnn.readNet(path)
    except cv2.error as error:
        raise ObjectModelUnavailable('Object detection runtime unavailable') from error
    grids, strides = [], []
    for stride in (8, 16, 32):
        size = INPUT_SIZE // stride
        xv, yv = np.meshgrid(np.arange(size), np.arange(size))
        grids.append(np.stack((xv, yv), 2).reshape(1, -1, 2))
        strides.append(np.full((1, size * size, 1), stride))
    _model = (net, np.concatenate(grids, 1), np.concatenate(strides, 1), f'yolox-opencv-zoo-{REVISION}-sha256-{actual}')
    return _model


def detector_version():
    return model()[3]


def requested_labels(value):
    """Person is always measured; other COCO labels follow the request. Non-COCO labels are left to advisory AI."""
    if value is None:
        value = []
    if not isinstance(value, list) or len(value) > 83 or not all(isinstance(label, str) for label in value):
        raise ValueError('Invalid detection_labels')
    return ['person'] + [label for label in CLASSES if label != 'person' and label in value]


def detect_objects(image, labels):
    """Return normalized {label, score, box} detections for the requested COCO labels."""
    height, width = image.shape[:2]
    ratio = min(INPUT_SIZE / height, INPUT_SIZE / width)
    padded = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, np.float32)
    resized = cv2.resize(cv2.cvtColor(image, cv2.COLOR_BGR2RGB), (int(width * ratio), int(height * ratio)), interpolation=cv2.INTER_LINEAR)
    padded[:resized.shape[0], :resized.shape[1]] = resized
    # OpenCV dnn networks are mutable; serialize inference across request threads.
    with _lock:
        net, grids, strides, _ = model()
        net.setInput(np.transpose(padded, (2, 0, 1))[np.newaxis])
        dets = net.forward(net.getUnconnectedOutLayersNames())[0][0]
    centers = (dets[:, :2] + grids[0]) * strides[0]
    sizes = np.exp(dets[:, 2:4]) * strides[0]
    boxes = np.concatenate([centers - sizes / 2, sizes], 1)
    # Only requested classes compete, so an unrequested class cannot suppress a requested one.
    # NMS is class-agnostic among them: one object keeps its best requested label.
    wanted = [CLASSES.index(label) for label in labels]
    scores = dets[:, 4:5] * dets[:, 5:][:, wanted]
    best, classes = scores.max(1), np.array(wanted)[scores.argmax(1)]
    keep = cv2.dnn.NMSBoxes(boxes.tolist(), best.tolist(), SCORE_THRESHOLD, NMS_THRESHOLD)
    detections = []
    for index in sorted(np.array(keep).reshape(-1), key=lambda i: -best[i]):
        label = CLASSES[int(classes[index])]
        x, y, w, h = boxes[index] / ratio
        x1, y1 = max(0.0, float(x)), max(0.0, float(y))
        x2, y2 = min(float(width), float(x + w)), min(float(height), float(y + h))
        if x2 <= x1 or y2 <= y1:
            continue
        detections.append({'label': label, 'score': round(float(best[index]), 3), 'box': {'x': x1 / width, 'y': y1 / height, 'width': (x2 - x1) / width, 'height': (y2 - y1) / height}})
        if len(detections) == MAX_DETECTIONS:
            break
    return detections
