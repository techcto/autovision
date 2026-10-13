import base64
import unittest
from pathlib import Path
from unittest.mock import patch
import cv2
import numpy as np
import objects
from server import analyze

# Authorized demo poster; images stay out of src/. Containers mount public/ at /app/public.
FIXTURE = Path(__file__).resolve().parents[2] / 'public' / 'demo' / 'backyardintruder-poster.jpg'
needs_fixture = unittest.skipUnless(FIXTURE.is_file(), 'mount public/ at /app/public for detector fixture tests')


class StubNet:
    """One object: an unrequested dog (0.9) and a requested person (0.6) predicted on the same box."""
    def __init__(self):
        self.dets = np.zeros((1, 8400, 85), np.float32)
        for row, cls, score in ((0, objects.CLASSES.index('dog'), 0.9), (1, 0, 0.6)):
            self.dets[0, row, :4] = (320, 320, np.log(200), np.log(300))
            self.dets[0, row, 4] = 1
            self.dets[0, row, 5 + cls] = score

    def setInput(self, blob):
        pass

    def getUnconnectedOutLayersNames(self):
        return ['output']

    def forward(self, names):
        return [self.dets]


def stub_model():
    return (StubNet(), np.zeros((1, 8400, 2)), np.ones((1, 8400, 1)), 'stub')


def fixture_frame(at):
    return {'image': base64.b64encode(FIXTURE.read_bytes()).decode(), 'at_ms': at}


class ObjectModelTests(unittest.TestCase):
    def test_missing_model_is_unavailable_not_empty_detections(self):
        with patch.object(objects, '_model', None), patch.dict(objects.os.environ, {}, clear=True):
            with self.assertRaises(objects.ObjectModelUnavailable):
                objects.model()

    def test_checksum_mismatch_does_not_load_model(self):
        with patch.object(objects, '_model', None), patch.dict(objects.os.environ, {'AUTOVISION_YOLOX_SHA256': '0' * 64}):
            with self.assertRaises(objects.ObjectModelUnavailable):
                objects.model()

    def test_detector_version_includes_revision_and_checksum(self):
        self.assertRegex(objects.detector_version(), r'^yolox-opencv-zoo-[0-9a-f]{40}-sha256-[0-9a-f]{64}$')


class ObjectDetectionTests(unittest.TestCase):
    def test_person_is_always_requested_and_other_labels_follow_the_request(self):
        self.assertEqual(objects.requested_labels(None), ['person'])
        self.assertEqual(objects.requested_labels(['package', 'dog', 'person', 'dog']), ['person', 'dog'])
        for value in ['dog', [1], ['dog'] * 84]:
            with self.assertRaises(ValueError):
                objects.requested_labels(value)

    def test_coco_catalog_has_80_labels(self):
        self.assertEqual(len(set(objects.CLASSES)), 80)

    @needs_fixture
    def test_person_detection_is_normalized(self):
        found = objects.detect_objects(cv2.imread(str(FIXTURE)), ['person'])
        self.assertTrue(found)
        for detection in found:
            self.assertEqual(detection['label'], 'person')
            self.assertTrue(0 < detection['score'] <= 1)
            box = detection['box']
            self.assertTrue(0 <= box['x'] and 0 <= box['y'] and box['x'] + box['width'] <= 1 and box['y'] + box['height'] <= 1)

    @needs_fixture
    def test_unrequested_labels_are_filtered(self):
        self.assertEqual(objects.detect_objects(cv2.imread(str(FIXTURE)), ['dog']), [])

    def test_unrequested_class_cannot_suppress_requested_class(self):
        image = np.zeros((640, 640, 3), np.uint8)
        with patch.object(objects, '_model', stub_model()):
            self.assertEqual([(d['label'], d['score']) for d in objects.detect_objects(image, ['person'])], [('person', 0.6)])
            # Both requested: one object keeps one label, the best one.
            self.assertEqual([d['label'] for d in objects.detect_objects(image, ['person', 'dog'])], ['dog'])

    @needs_fixture
    def test_analysis_metadata_and_requested_label_observations(self):
        result = analyze({'frames': [fixture_frame(0), fixture_frame(1000)], 'detection_labels': ['dog']})
        self.assertEqual(result['engine'], 'opencv5-motion+yolox')
        self.assertEqual(result['engine_version'], cv2.__version__)
        self.assertEqual(result['detector_version'], objects.detector_version())
        self.assertEqual([o['type'] for o in result['observations']], ['person', 'motion', 'dog'])
        self.assertTrue(result['observations'][0]['detected'])
        self.assertEqual([o['type'] for o in result['frames'][1]['observations']], ['person', 'motion', 'dog'])
        self.assertEqual(result['frames'][0]['detections'][0]['label'], 'person')

    @needs_fixture
    def test_unavailable_model_fails_analysis(self):
        with patch.object(objects, '_model', None), patch.dict(objects.os.environ, {}, clear=True):
            with self.assertRaises(objects.ObjectModelUnavailable):
                analyze({'frames': [fixture_frame(0)]})


if __name__ == '__main__':
    unittest.main()
