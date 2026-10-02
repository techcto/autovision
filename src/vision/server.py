"""Bounded OpenCV image comparison service, accessible only within the app network."""
import base64
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import cv2
import numpy as np


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
    return {'observations': observations, 'metrics': {'latency_ms': round((time.perf_counter() - start) * 1000, 3)}, 'engine': 'opencv', 'engine_version': cv2.__version__, 'simulated': v.get('demo') is True}


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, value):
        data = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.respond(200 if self.path == '/api/health' else 404, {'status': 'ok', 'engine_version': cv2.__version__})

    def do_POST(self):
        if self.path != '/detect':
            return self.respond(404, {'error': 'not found'})
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size <= 4000000:
            return self.respond(413, {'error': 'request too large'})
        try:
            result = detect(json.loads(self.rfile.read(size)))
            self.respond(200, result)
        except (ValueError, TypeError, KeyError, cv2.error):
            self.respond(400, {'error': 'Invalid images or detection options'})


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()

