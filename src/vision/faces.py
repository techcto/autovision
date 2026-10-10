"""Stateless, opt-in face measurements with checksum-verified model files.

No images, embeddings, names, or face galleries are written by this module.
The standard vision image provisions pinned OpenCV Zoo weights at build time.
Hashes identify the embedding space exactly; runtime never downloads weights.
"""
import hashlib
import os
from pathlib import Path
import threading
import cv2
import numpy as np

_lock = threading.Lock()
_models = None


class FaceModelsUnavailable(RuntimeError):
    pass


def models():
    global _models
    if _models is not None:
        return _models
    paths, hashes = [], []
    for name in ('YUNET', 'SFACE'):
        path = os.environ.get('AUTOVISION_' + name + '_MODEL', '')
        expected = os.environ.get('AUTOVISION_' + name + '_SHA256', '')
        if not path or len(expected) != 64 or not Path(path).is_file():
            raise FaceModelsUnavailable('Face models are not configured')
        actual = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        if actual != expected.lower():
            raise FaceModelsUnavailable('Face model checksum mismatch')
        paths.append(path)
        hashes.append(actual)
    try:
        detector = cv2.FaceDetectorYN.create(paths[0], '', (320, 320), 0.9, 0.3, 500)
        recognizer = cv2.FaceRecognizerSF.create(paths[1], '')
    except (cv2.error, AttributeError) as error:
        raise FaceModelsUnavailable('Face runtime unavailable') from error
    _models = (detector, recognizer, 'yunet:' + hashes[0] + '/sface:' + hashes[1])
    return _models


def measure_faces(value, decode_image):
    if not isinstance(value, dict):
        raise ValueError('JSON object required')
    frames = value.get('frames')
    if not isinstance(frames, list) or not 1 <= len(frames) <= 12:
        raise ValueError('Supply 1–12 frames')
    output, previous = [], -1
    # OpenCV model objects are mutable; serialize detection/alignment together.
    with _lock:
        detector, recognizer, model_id = models()
        for frame in frames:
            at = frame.get('at_ms')
            if isinstance(at, bool) or not isinstance(at, (int, float)) or not np.isfinite(at) or not previous < at <= 30000:
                raise ValueError('Invalid frame timestamp')
            image = decode_image(frame.get('image'))
            height, width = image.shape[:2]
            detector.setInputSize((width, height))
            _, faces = detector.detect(image)
            measurements = []
            for face in ([] if faces is None else faces[:20]):
                x, y, w, h = [float(n) for n in face[:4]]
                # Tiny or clipped faces are not useful enrollment evidence.
                if min(w, h) < 40 or x < 0 or y < 0 or x+w > width or y+h > height:
                    continue
                feature = recognizer.feature(recognizer.alignCrop(image, face)).reshape(-1).astype(float)
                norm = np.linalg.norm(feature)
                if feature.size != 128 or not np.isfinite(feature).all() or norm <= 0:
                    continue
                measurements.append({'box': {'x': x/width, 'y': y/height, 'width': w/width, 'height': h/height}, 'embedding': (feature/norm).tolist()})
            output.append({'at_ms': at, 'faces': measurements})
            previous = at
    return {'model_id': model_id, 'frames': output, 'limitations': ['Face matching is not performed by AutoVision.', 'No identity or calibrated match confidence is returned.', 'Small, obscured, or clipped faces may be omitted.']}
