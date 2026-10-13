"""Reproducible evaluation.

Default: synthetic motion masks (not object-detector accuracy).
With video paths: YOLOX detections on frames sampled like the browser, compared with
the recorded OpenCV 4.13 HOG historical baseline (devops/testing/hog_baseline.json) where available.
The baseline is dev-only: run from a source checkout, or mount devops/testing at /app/devops/testing.
"""
import base64
import hashlib
import json
import math
import platform
import statistics
import sys
import time
from pathlib import Path
import numpy as np
import cv2


def synthetic():
    from server import analyze
    from test_server import frame
    cases = []
    for name, fraction in [("static", 0), ("small_patch", 0.05), ("large_patch", 0.5), ("lighting_change", 1)]:
        before = np.zeros((180, 320, 3), np.uint8)
        after = before.copy()
        after[:, :round(320 * fraction)] = 255
        runs = [analyze({"frames": [frame(before, 0), frame(after, 1000)]}) for _ in range(5)]
        motion = runs[-1]["observations"][1]
        cases.append({"case": name, "expected_changed_fraction": fraction, "measured_fraction": motion["value"], "detected": motion["detected"], "latency_ms_median": statistics.median(r["metrics"]["latency_ms"] for r in runs)})
        assert abs(motion["value"] - fraction) < 0.001
        assert motion["detected"] == (fraction > 0.01)
    return {"opencv_version": cv2.__version__, "platform": platform.machine(), "runs_per_case": 5, "cases": cases, "limitations": ["Synthetic changed-pixel test, not real-world object accuracy.", "Lighting changes also trigger motion; motion is not an intruder classification.", "Object detection and Nova grounding require separate representative evaluation (pass video paths)."]}


def sample_video(path):
    """Sample frames like the browser Live Lab: up to 12 evenly spaced, at most 640 px, JPEG quality 80."""
    capture = cv2.VideoCapture(str(path))
    fps, count = capture.get(cv2.CAP_PROP_FPS), capture.get(cv2.CAP_PROP_FRAME_COUNT)
    if not fps or not count:
        raise ValueError(f'Cannot read {path}')
    duration = count / fps
    total = min(12, max(2, math.ceil(duration) + 1))
    frames = []
    for i in range(total):
        at = min(max(0, duration - 0.05), i * duration / (total - 1))
        capture.set(cv2.CAP_PROP_POS_MSEC, at * 1000)
        ok, image = capture.read()
        if not ok:
            raise ValueError(f'Cannot decode {path} at {at:.2f}s')
        h, w = image.shape[:2]
        ratio = min(1, 640 / w, 640 / h)
        image = cv2.resize(image, (max(1, round(w * ratio)), max(1, round(h * ratio))))
        data = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 80])[1].tobytes()
        frames.append({'at_ms': round(at * 1000), 'sha256': hashlib.sha256(data).hexdigest(), 'image': base64.b64encode(data).decode()})
    capture.release()
    return frames


def latency(values):
    if not values:
        return None
    ordered = sorted(values)
    return {'frames': len(values), 'mean_ms': round(statistics.mean(values), 1), 'median_ms': round(statistics.median(values), 1), 'p95_ms': round(ordered[min(len(ordered) - 1, math.ceil(0.95 * len(ordered)) - 1)], 1), 'max_ms': round(ordered[-1], 1)}


def detectors(paths):
    from objects import CLASSES, detect_objects, detector_version
    from server import decode_image
    baseline_path = Path(__file__).resolve().parents[2] / 'devops' / 'testing' / 'hog_baseline.json'
    baseline = json.loads(baseline_path.read_text()) if baseline_path.is_file() else {'videos': {}}
    videos, yolox_ms, hog_ms = [], [], []
    for path in paths:
        digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        recorded = {f['at_ms']: f for f in baseline['videos'].get(digest, {}).get('frames', [])}
        frames = []
        for sampled in sample_video(path):
            image = decode_image(sampled['image'])
            start = time.perf_counter()
            found = detect_objects(image, list(CLASSES))
            elapsed = (time.perf_counter() - start) * 1000
            yolox_ms.append(elapsed)
            hog = recorded.get(sampled['at_ms'])
            if hog:
                hog_ms.append(hog['latency_ms'])
            frames.append({'at_ms': sampled['at_ms'], 'frame_sha256': sampled['sha256'],
                           'yolox': {'latency_ms': round(elapsed, 1), 'detections': found},
                           'hog_baseline': None if not hog else {'latency_ms': hog['latency_ms'], 'detections': hog['detections'], 'same_frame': hog['frame_sha256'] == sampled['sha256']}})
        videos.append({'file': Path(path).name, 'sha256': digest, 'frames': frames})
    return {'opencv_version': cv2.__version__, 'platform': platform.machine(), 'detector': detector_version(),
            'hog_baseline': {key: baseline[key] for key in ('note', 'opencv_version', 'recorded_at') if key in baseline},
            'videos': videos, 'latency': {'yolox': latency(yolox_ms), 'hog_baseline': latency(hog_ms)},
            'limitations': ['Detector scores are not calibrated probabilities.', 'HOG results are a historical baseline, not the production implementation.', 'Small sample; not a representative accuracy benchmark.']}


if __name__ == '__main__':
    print(json.dumps(detectors(sys.argv[1:]) if len(sys.argv) > 1 else synthetic(), indent=2))
