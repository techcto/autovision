"""Bounded evidence transformations; no new model and no recovery of missing detail."""
import base64
import cv2
import numpy as np

def inspect(value, decode, analyze):
    operation = value.get('operation')
    if operation not in ('inspect_region', 'enhance_low_light'):
        raise ValueError('Invalid inspection operation')
    image = decode(value.get('image'))
    original_h, original_w = image.shape[:2]
    x0, y0, crop_w, crop_h = 0, 0, original_w, original_h
    if operation == 'inspect_region':
        box = value.get('box')
        if not isinstance(box, dict) or any(isinstance(box.get(k), bool) or not isinstance(box.get(k), (int, float)) or not np.isfinite(box[k]) for k in ('x', 'y', 'width', 'height')):
            raise ValueError('Invalid crop')
        x, y, width, height = (box[k] for k in ('x', 'y', 'width', 'height'))
        padding = value.get('padding', .15)
        if not 0 <= padding <= .5 or not 0 <= x < 1 or not 0 <= y < 1 or width <= 0 or height <= 0 or x+width > 1.001 or y+height > 1.001:
            raise ValueError('Invalid crop bounds')
        x0, y0 = max(0, int((x-width*padding)*original_w)), max(0, int((y-height*padding)*original_h))
        x1, y1 = min(original_w, int((x+width*(1+padding))*original_w)), min(original_h, int((y+height*(1+padding))*original_h))
        crop_w, crop_h = x1-x0, y1-y0
        if min(crop_w, crop_h) < 8:
            raise ValueError('Crop too small')
        image = image[y0:y1, x0:x1]
    else:
        strength = value.get('strength', 2)
        if not isinstance(strength, (int, float)) or not np.isfinite(strength) or not 1 <= strength <= 4:
            raise ValueError('Invalid enhancement strength')
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        lab[:, :, 0] = cv2.createCLAHE(clipLimit=float(strength), tileGridSize=(8, 8)).apply(lab[:, :, 0])
        image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    encoded = base64.b64encode(cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 80])[1]).decode()
    if len(encoded) > 1500000:
        raise ValueError('Transformed image too large')
    result = analyze({'frames': [{'image': encoded, 'at_ms': 0}], 'detection_labels': value.get('detection_labels')})
    result.pop('thumbnail', None)
    frame = result['frames'][0]
    for detection in frame['detections']:
        b = detection['box']
        detection['box'] = {'x': (x0+b['x']*crop_w)/original_w, 'y': (y0+b['y']*crop_h)/original_h, 'width': b['width']*crop_w/original_w, 'height': b['height']*crop_h/original_h}
    return {'operation': operation, 'coordinate_space': 'original_image', 'preview_space': 'transformed_image', 'result': result, 'limitations': ['Enhancement does not recover missing detail; detector scores are not calibrated probabilities.']}
