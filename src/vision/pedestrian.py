"""Isolated legacy HOG adapter; core media processing runs on OpenCV 5."""
import base64
import json
import sys
import cv2
import numpy as np


def detect_people(frames):
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    results = []
    for frame in frames:
        image = cv2.imdecode(np.frombuffer(base64.b64decode(frame["image"], validate=True), np.uint8), cv2.IMREAD_COLOR)
        if image is None or max(image.shape[:2]) > 2048:
            raise ValueError("Invalid image")
        h, w = image.shape[:2]
        image = cv2.resize(image, (max(1, round(w * min(1, 640 / w))), max(1, round(h * min(1, 640 / w)))))
        boxes = []
        if image.shape[0] >= 128 and image.shape[1] >= 64:
            rects, weights = hog.detectMultiScale(image, winStride=(8, 8), padding=(8, 8), scale=1.1)
            for (x, y, bw, bh), weight in zip(rects, weights):
                boxes.append({"label": "person", "score": round(float(weight), 3), "box": {"x": float(x/image.shape[1]), "y": float(y/image.shape[0]), "width": float(bw/image.shape[1]), "height": float(bh/image.shape[0])}})
        results.append(boxes)
    return results


if __name__ == "__main__":
    print(json.dumps(detect_people(json.load(sys.stdin))))
