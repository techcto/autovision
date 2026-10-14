import base64
import unittest
import cv2
import numpy as np
from inspection import inspect

class InspectionTests(unittest.TestCase):
    def setUp(self):
        self.image = np.zeros((100, 200, 3), np.uint8) + 25
        self.encoded = base64.b64encode(cv2.imencode('.jpg', self.image)[1]).decode()
    def decode(self, value):
        return cv2.imdecode(np.frombuffer(base64.b64decode(value), np.uint8), cv2.IMREAD_COLOR)
    def analyze(self, value):
        current = self.decode(value['frames'][0]['image'])
        self.transformed = current
        return {'engine_version': cv2.__version__, 'frames': [{'detections': [{'label': 'person', 'box': {'x': 0, 'y': 0, 'width': 1, 'height': 1}}]}]}
    def test_runtime_and_crop_mapping(self):
        self.assertEqual(cv2.__version__, '5.0.0')
        result = inspect({'operation': 'inspect_region', 'image': self.encoded, 'box': {'x': .25, 'y': .2, 'width': .5, 'height': .6}, 'padding': 0}, self.decode, self.analyze)
        self.assertEqual(self.transformed.shape[:2], (60, 100))
        self.assertEqual(result['result']['frames'][0]['detections'][0]['box'], {'x': .25, 'y': .2, 'width': .5, 'height': .6})
    def test_clahe_and_validation(self):
        inspect({'operation': 'enhance_low_light', 'image': self.encoded, 'strength': 2}, self.decode, self.analyze)
        self.assertEqual(self.transformed.shape, self.image.shape)
        self.assertFalse(np.array_equal(self.transformed, self.image))
        for operation in ['shell', 'unknown']:
            with self.assertRaises(ValueError):
                inspect({'operation': operation, 'image': self.encoded}, self.decode, self.analyze)

if __name__ == '__main__':
    unittest.main()
