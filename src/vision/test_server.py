import base64
import unittest
import cv2
import numpy as np
from server import analyze, detect


def frame(image, at):
    return {'image': base64.b64encode(cv2.imencode('.png', image)[1]).decode(), 'at_ms': at}


class AnalysisTests(unittest.TestCase):
    def test_opencv5_runtime(self):
        self.assertTrue(cv2.__version__.startswith("5."))

    def test_static_negative(self):
        image = np.zeros((128, 128, 3), np.uint8)
        result = analyze({"frames": [frame(image, 0), frame(image, 1000)]})
        self.assertEqual(result["observations"][1]["value"], 0)
        self.assertFalse(result["observations"][1]["detected"])

    def test_legacy_demo(self):
        self.assertTrue(detect({'demo': True})['observations'][0]['detected'])

    def test_image_and_motion(self):
        previous = np.zeros((128, 128, 3), np.uint8)
        current = previous.copy()
        current[32:96, 32:96] = 255
        result = analyze({'frames': [frame(previous, 0), frame(current, 1000)]})
        self.assertTrue(result['observations'][1]['detected'])
        self.assertEqual(len(result['frames']), 2)
        self.assertEqual(analyze({'frames': [frame(previous, 0)]})['observations'][0]['value'], 0)

    def test_limits(self):
        image = frame(np.zeros((128, 128, 3), np.uint8), 0)
        for frames in [[], [image]*13, [image, image], [{'image': 'aGVsbG8=', 'at_ms': 0}]]:
            with self.assertRaises(ValueError):
                analyze({'frames': frames})

    def test_sampled_previews_are_bounded_and_preserve_aspect(self):
        image = np.random.default_rng(1).integers(0, 256, (360, 640, 3), dtype=np.uint8)
        result = analyze({'frames': [frame(image, 0)]})
        preview = result['frames'][0]['preview']
        self.assertLessEqual(len(preview), 24000)
        decoded = cv2.imdecode(np.frombuffer(base64.b64decode(preview), np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual(decoded.shape[:2], (180, 320))


if __name__ == '__main__':
    unittest.main()
