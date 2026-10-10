"""Bounded OpenCV image comparison service, accessible only within the app network."""
import base64
import json
import time
import threading
import subprocess
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import cv2
import numpy as np
from faces import measure_faces, FaceModelsUnavailable

_slots = threading.BoundedSemaphore(2)


def decode_image(value):
    if not isinstance(value, str) or len(value) > 1500000:
        raise ValueError('Invalid image')
    data = base64.b64decode(value, validate=True)
    if not data.startswith((b'\xff\xd8\xff', b'\x89PNG\r\n\x1a\n')):
        raise ValueError('JPEG or PNG required')
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.shape[0] > 2048 or image.shape[1] > 2048:
        raise ValueError('Invalid or oversized image')
    return image


def analyze(v):
    start = time.perf_counter()
    frames = v.get('frames')
    if not isinstance(frames, list) or not 1 <= len(frames) <= 12:
        raise ValueError('Supply 1–12 frames')
    last_at = -1
    for frame in frames:
        if not isinstance(frame, dict):
            raise ValueError("Invalid frame")
        at = frame.get("at_ms")
        if isinstance(at, bool) or not isinstance(at, (int, float)) or not np.isfinite(at) or not last_at < at <= 30000:
            raise ValueError("Invalid frame timestamp")
        decode_image(frame.get("image"))
        last_at = at
    pedestrian_python = os.environ.get('AUTOVISION_PEDESTRIAN_PYTHON')
    if not pedestrian_python:
        raise RuntimeError('Pedestrian detector runtime is not configured')
    people = subprocess.run([pedestrian_python, str(Path(__file__).with_name('pedestrian.py'))],
                            input=json.dumps(frames), text=True, capture_output=True, timeout=35, check=True)
    person_boxes = json.loads(people.stdout)
    results, previous, last_at = [], None, -1
    for frame_index, frame in enumerate(frames):
        at = frame.get('at_ms')
        if isinstance(at, bool) or not isinstance(at, (int, float)) or not np.isfinite(at) or not last_at < at <= 30000:
            raise ValueError('Frame timestamps must increase within 30 seconds')
        current = decode_image(frame.get('image'))
        boxes = person_boxes[frame_index]
        gray = cv2.resize(cv2.cvtColor(current, cv2.COLOR_BGR2GRAY), (320, 180))
        motion = None if previous is None else float(cv2.countNonZero(cv2.threshold(cv2.absdiff(gray, previous), 30, 255, cv2.THRESH_BINARY)[1]) / gray.size)
        observations = [{'type': 'person', 'value': len(boxes), 'detected': bool(boxes)}]
        if motion is not None:
            observations.append({'type': 'motion', 'value': motion, 'detected': motion > 0.01})
        # Bounded, aspect-preserving evidence; <=12 small JPEGs keeps each job
        # below DynamoDB's item limit without retaining the source video.
        h, w = current.shape[:2]
        scale = min(1, 320 / max(h, w))
        preview = base64.b64encode(cv2.imencode('.jpg', cv2.resize(current, (max(1, round(w*scale)), max(1, round(h*scale)))), [cv2.IMWRITE_JPEG_QUALITY, 45])[1]).decode()
        if len(preview) > 24000:
            preview = base64.b64encode(cv2.imencode('.jpg', cv2.resize(current, (max(1, round(w*scale/2)), max(1, round(h*scale/2)))), [cv2.IMWRITE_JPEG_QUALITY, 35])[1]).decode()
        results.append({'at_ms': at, 'observations': observations, 'detections': boxes, 'preview': preview})
        previous, last_at = gray, at
    thumbnail = base64.b64encode(cv2.imencode('.jpg', cv2.resize(decode_image(frames[0]['image']), (160, 90)), [cv2.IMWRITE_JPEG_QUALITY, 50])[1]).decode()
    return {'thumbnail': thumbnail, 'frames': results, 'observations': [{'type': 'person', 'value': max(f['observations'][0]['value'] for f in results), 'detected': any(f['detections'] for f in results)}, {'type': 'motion', 'value': max((o['value'] for f in results for o in f['observations'] if o['type'] == 'motion'), default=0), 'detected': any(o['detected'] for f in results for o in f['observations'] if o['type'] == 'motion')}], 'engine': 'opencv5-motion+legacy-hog', 'engine_version': cv2.__version__, 'detector_version': 'opencv4-hog-4.13.0', 'metrics': {'latency_ms': round((time.perf_counter() - start) * 1000, 3)}, 'limitations': ['Pedestrian detector, not a general object or fire classifier.', 'Detector scores are not calibrated probabilities.', 'Sampled frames may miss events between samples.']}


def detect(v):
    start = time.perf_counter()
    if v.get('demo') is True:
        previous = np.zeros((128, 128, 3), dtype=np.uint8)
        current = previous.copy()
        current[32:96, 32:96] = 255
    else:
        def decode(value):
            data = base64.b64decode(value, validate=True)
            image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if image is None or image.size > 16777216 * 3:
                raise ValueError('Invalid or oversized image')
            return image
        current, previous = decode(v['image']), decode(v['previous_image'])
    if current.shape != previous.shape:
        raise ValueError('Images must have matching dimensions')
    threshold = int(v.get('threshold', 30))
    if not 1 <= threshold <= 255:
        raise ValueError('threshold must be between 1 and 255')
    delta = cv2.absdiff(cv2.cvtColor(current, cv2.COLOR_BGR2GRAY), cv2.cvtColor(previous, cv2.COLOR_BGR2GRAY))
    mask = cv2.threshold(delta, threshold, 255, cv2.THRESH_BINARY)[1]
    score = float(cv2.countNonZero(mask) / mask.size)
    observations = [{'type': 'motion', 'value': score, 'detected': score > 0.01}]
    thumbnail = base64.b64encode(cv2.imencode('.jpg', cv2.resize(current, (160, 90)), [cv2.IMWRITE_JPEG_QUALITY, 50])[1]).decode()
    return {'thumbnail': thumbnail, 'observations': observations, 'metrics': {'latency_ms': round((time.perf_counter() - start) * 1000, 3)}, 'engine': 'opencv', 'engine_version': cv2.__version__, 'simulated': v.get('demo') is True}


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, value):
        data = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.respond(200 if self.path == '/api/health' else 404, {'status': 'ok', 'engine_version': cv2.__version__})

    def do_POST(self):
        if self.path not in ('/detect', '/analyze', '/faces'):
            return self.respond(404, {'error': 'not found'})
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size <= 4000000:
            return self.respond(413, {'error': 'request too large'})
        if not _slots.acquire(blocking=False):
            return self.respond(429, {'error': 'Vision service busy'})
        try:
            value = json.loads(self.rfile.read(size))
            result = measure_faces(value, decode_image) if self.path == '/faces' else (analyze if self.path == '/analyze' else detect)(value)
            self.respond(200, result)
        except FaceModelsUnavailable:
            self.respond(503, {'error': 'Face measurement models unavailable'})
        except (ValueError, TypeError, KeyError, cv2.error, subprocess.SubprocessError, RuntimeError):
            self.respond(400, {'error': 'Invalid images or detection options'})
        finally:
            _slots.release()


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()

