import unittest
from unittest.mock import patch
import numpy as np
import faces


class Detector:
    def setInputSize(self, size):
        self.size = size

    def detect(self, image):
        # x, y, width, height, five landmark pairs, detector score.
        return None, np.array([[20, 20, 50, 50] + [30, 30]*5 + [0.99]], dtype=np.float32)


class Recognizer:
    def alignCrop(self, image, face):
        return image

    def feature(self, image):
        return np.ones((1, 128), dtype=np.float32)


class FaceTests(unittest.TestCase):
    def test_missing_models_are_unavailable_not_empty_faces(self):
        with patch.object(faces, '_models', None), patch.dict(faces.os.environ, {}, clear=True):
            with self.assertRaises(faces.FaceModelsUnavailable):
                faces.models()

    def test_checksum_mismatch_does_not_load_models(self):
        with patch.object(faces, '_models', None), patch.dict(faces.os.environ, {
            'AUTOVISION_YUNET_MODEL': '/operator/model.onnx',
            'AUTOVISION_YUNET_SHA256': 'a'*64,
        }, clear=True), patch.object(faces, 'Path') as path:
            path.return_value.is_file.return_value = True
            path.return_value.read_bytes.return_value = b'not-the-pinned-model'
            with self.assertRaises(faces.FaceModelsUnavailable):
                faces.models()

    def test_measurements_are_normalized_bounded_and_stateless(self):
        with patch.object(faces, 'models', return_value=(Detector(), Recognizer(), 'synthetic-model')):
            result = faces.measure_faces({'frames': [{'image': 'synthetic', 'at_ms': 0}]}, lambda _: np.zeros((100, 100, 3), dtype=np.uint8))
        face = result['frames'][0]['faces'][0]
        self.assertEqual(face['box'], {'x': 0.2, 'y': 0.2, 'width': 0.5, 'height': 0.5})
        self.assertEqual(len(face['embedding']), 128)
        self.assertAlmostEqual(np.linalg.norm(face['embedding']), 1)
        self.assertNotIn('image', result['frames'][0])
        self.assertNotIn('name', face)

    def test_invalid_batches_and_timestamps(self):
        for value in [None, {}, {'frames': []}, {'frames': [{}]*13}]:
            with self.assertRaises(ValueError):
                faces.measure_faces(value, lambda _: None)
        with patch.object(faces, 'models', return_value=(Detector(), Recognizer(), 'synthetic-model')):
            for at in [True, -1, 30001, float('nan')]:
                with self.assertRaises(ValueError):
                    faces.measure_faces({'frames': [{'image': 'synthetic', 'at_ms': at}]}, lambda _: None)


if __name__ == '__main__':
    unittest.main()
