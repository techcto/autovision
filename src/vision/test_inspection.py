import base64
import unittest
from pathlib import Path
import cv2
import numpy as np
from inspection import inspect
from server import analyze, decode_image

# Authorized demo media; containers mount public/ at /app/public (see test_objects.py).
PUBLIC = Path(__file__).resolve().parents[2] / 'public'
POSTER, CLIP = PUBLIC / 'demo' / 'backyardintruder-poster.jpg', PUBLIC / 'backyardintruder.mp4'
needs_fixture = unittest.skipUnless(POSTER.is_file() and CLIP.is_file(), 'mount public/ at /app/public for real YOLOX crop tests')


def iou(a, b):
    x = max(0, min(a['x']+a['width'], b['x']+b['width']) - max(a['x'], b['x']))
    y = max(0, min(a['y']+a['height'], b['y']+b['height']) - max(a['y'], b['y']))
    return x*y / (a['width']*a['height'] + b['width']*b['height'] - x*y)


def redetected(image, detection):
    found = inspect({'operation': 'inspect_region', 'image': image, 'box': detection['box'], 'padding': .15}, decode_image, analyze)
    return any(d['label'] == detection['label'] and iou(d['box'], detection['box']) > .5 for d in found['result']['frames'][0]['detections'])

class InspectionTests(unittest.TestCase):
    def setUp(self):
        self.image = np.zeros((100, 200, 3), np.uint8) + 25
        self.encoded = base64.b64encode(cv2.imencode('.jpg', self.image)[1]).decode()
    def decode(self, value):
        return cv2.imdecode(np.frombuffer(base64.b64decode(value), np.uint8), cv2.IMREAD_COLOR)
    def analyze(self, value):
        current = self.decode(value['frames'][0]['image'])
        self.transformed = current
        return {'engine_version': cv2.__version__, 'frames': [{'quality': {'brightness': 114}, 'detections': [dict(d) for d in self.detections]}]}
    detections = [{'label': 'person', 'box': {'x': 0, 'y': 0, 'width': 1, 'height': 1}}]
    def test_runtime_and_crop_mapping(self):
        self.assertEqual(cv2.__version__, '5.0.0')
        result = inspect({'operation': 'inspect_region', 'image': self.encoded, 'box': {'x': .25, 'y': .2, 'width': .5, 'height': .6}, 'padding': 0}, self.decode, self.analyze)
        # Small crops sit on a 320px gray canvas so YOLOX upscales at most 2x.
        self.assertEqual(self.transformed.shape[:2], (320, 320))
        self.assertLess(abs(int(self.transformed[30, 50, 0]) - 25), 4)
        self.assertLess(abs(int(self.transformed[200, 200, 0]) - 114), 4)
        self.assertEqual(result['result']['frames'][0]['detections'][0]['box'], {'x': .25, 'y': .2, 'width': .5, 'height': .6})
        self.assertLess(abs(result['result']['frames'][0]['quality']['brightness'] - 25), 4)
    def test_canvas_padding_detections_are_dropped(self):
        self.detections = [{'label': 'person', 'box': {'x': .5, 'y': .5, 'width': .4, 'height': .4}}]
        result = inspect({'operation': 'inspect_region', 'image': self.encoded, 'box': {'x': .25, 'y': .2, 'width': .5, 'height': .6}, 'padding': 0}, self.decode, self.analyze)
        self.assertEqual(result['result']['frames'][0]['detections'], [])
    def test_large_crop_is_not_padded(self):
        image = np.zeros((800, 1000, 3), np.uint8) + 25
        encoded = base64.b64encode(cv2.imencode('.jpg', image)[1]).decode()
        result = inspect({'operation': 'inspect_region', 'image': encoded, 'box': {'x': .1, 'y': .1, 'width': .5, 'height': .5}, 'padding': 0}, self.decode, self.analyze)
        self.assertEqual(self.transformed.shape[:2], (400, 500))
        self.assertEqual(result['result']['frames'][0]['detections'][0]['box'], {'x': .1, 'y': .1, 'width': .5, 'height': .5})
    def test_clahe_and_validation(self):
        inspect({'operation': 'enhance_low_light', 'image': self.encoded, 'strength': 2}, self.decode, self.analyze)
        self.assertEqual(self.transformed.shape, self.image.shape)
        self.assertFalse(np.array_equal(self.transformed, self.image))
        for operation in ['shell', 'unknown']:
            with self.assertRaises(ValueError):
                inspect({'operation': operation, 'image': self.encoded}, self.decode, self.analyze)

class RealYoloxCropTests(unittest.TestCase):
    """Real pinned YOLOX, no stub: a crop must find the person the full frame found."""
    @needs_fixture
    def test_live_artifact_crop_redetects_person(self):
        # Exact crop step recorded in devops/testing/autonomous-inspection-live.json, which missed before the 2x cap.
        box = {'x': 0.4165959894657135, 'y': 0.23419763776991104, 'width': 0.09841214418411255, 'height': 0.473868645562066}
        image = base64.b64encode(POSTER.read_bytes()).decode()
        self.assertTrue(redetected(image, {'label': 'person', 'box': box}))

    @needs_fixture
    def test_demo_clip_crops_redetect_people(self):
        # Frames sampled like the browser (long side <= 640, JPEG 80), plus a 320px stress case for small crops.
        capture = cv2.VideoCapture(str(CLIP))
        count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        for side, allowed_misses in ((640, 0), (320, 1)):
            people = misses = 0
            for index in np.linspace(0, count-1, 8).astype(int):
                capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
                ok, frame = capture.read()
                self.assertTrue(ok)
                ratio = min(1, side/frame.shape[1], side/frame.shape[0])
                frame = cv2.resize(frame, (round(frame.shape[1]*ratio), round(frame.shape[0]*ratio)), interpolation=cv2.INTER_AREA)
                image = base64.b64encode(cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])[1]).decode()
                for detection in analyze({'frames': [{'image': image, 'at_ms': 0}]})['frames'][0]['detections']:
                    people += 1
                    misses += not redetected(image, detection)
            self.assertGreaterEqual(people, 8)
            self.assertLessEqual(misses, allowed_misses, f'{misses}/{people} crops missed at {side}px')

if __name__ == '__main__':
    unittest.main()
