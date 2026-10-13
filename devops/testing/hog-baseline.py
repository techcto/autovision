"""Dev-only: record the retired OpenCV 4.13 HOG pedestrian detector as a historical baseline.

Not part of any image. OpenCV 5 has no HOGDescriptor, so run it in a throwaway 4.13 container:

  docker run --rm -v "$PWD":/repo:ro python:3.13-slim sh -c \
    'pip install -q opencv-python-headless==4.13.0.92 numpy==2.5.3 && \
     python /repo/devops/testing/hog-baseline.py /repo/public/*.mp4' > devops/testing/hog_baseline.json

Frames are sampled by src/vision/evaluate.py exactly as the YOLOX evaluation samples them.
"""
import datetime
import hashlib
import json
import sys
import time
from pathlib import Path
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'vision'))
from evaluate import sample_video  # noqa: E402


def hog_people(hog, image):
    # Same parameters as the retired src/vision/pedestrian.py adapter.
    boxes = []
    if image.shape[0] >= 128 and image.shape[1] >= 64:
        rects, weights = hog.detectMultiScale(image, winStride=(8, 8), padding=(8, 8), scale=1.1)
        for (x, y, w, h), weight in zip(rects, weights):
            boxes.append({'label': 'person', 'score': round(float(weight), 3), 'box': {'x': float(x / image.shape[1]), 'y': float(y / image.shape[0]), 'width': float(w / image.shape[1]), 'height': float(h / image.shape[0])}})
    return boxes


if __name__ == '__main__':
    import base64
    import numpy as np
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    videos = {}
    for path in sys.argv[1:]:
        frames = []
        for sampled in sample_video(path):
            image = cv2.imdecode(np.frombuffer(base64.b64decode(sampled['image']), np.uint8), cv2.IMREAD_COLOR)
            start = time.perf_counter()
            found = hog_people(hog, image)
            frames.append({'at_ms': sampled['at_ms'], 'frame_sha256': sampled['sha256'], 'latency_ms': round((time.perf_counter() - start) * 1000, 1), 'detections': found})
        videos[hashlib.sha256(Path(path).read_bytes()).hexdigest()] = {'file': Path(path).name, 'frames': frames}
    print(json.dumps({'note': 'Historical baseline of the retired OpenCV 4.13 HOG pedestrian detector; not the production implementation.',
                      'opencv_version': cv2.__version__, 'recorded_at': datetime.date.today().isoformat(), 'videos': videos}, indent=1))
