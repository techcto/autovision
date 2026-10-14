"""Bounded evidence transformations; no new model and no recovery of missing detail."""
import base64
import cv2
import numpy as np
from objects import INPUT_SIZE

MAX_UPSCALE = 2

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
        # detect_objects already upscales every input to 640 (letterbox), so a 41x111 crop was
        # enlarged ~6x and YOLOX lost the person. The canvas is not padding for context: it caps
        # that built-in upscale at MAX_UPSCALE, using the detector's own 114 letterbox gray.
        # An extra cv2.resize upscale measured worse (see RealYoloxCropTests).
        side = int(np.ceil(INPUT_SIZE / MAX_UPSCALE))
        if max(crop_w, crop_h) < side:
            canvas = np.full((side, side, 3), 114, np.uint8)
            canvas[:crop_h, :crop_w] = image
            image = canvas
    else:
        strength = value.get('strength', 2)
        if not isinstance(strength, (int, float)) or not np.isfinite(strength) or not 1 <= strength <= 4:
            raise ValueError('Invalid enhancement strength')
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        lab[:, :, 0] = cv2.createCLAHE(clipLimit=float(strength), tileGridSize=(8, 8)).apply(lab[:, :, 0])
        image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    space_h, space_w = image.shape[:2]
    encoded = base64.b64encode(cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 80])[1]).decode()
    if len(encoded) > 1500000:
        raise ValueError('Transformed image too large')
    result = analyze({'frames': [{'image': encoded, 'at_ms': 0}], 'detection_labels': value.get('detection_labels')})
    result.pop('thumbnail', None)
    frame = result['frames'][0]
    if operation == 'inspect_region':
        # Brightness of the crop itself, not of the gray canvas around it.
        frame['quality'] = {'brightness': round(float(cv2.cvtColor(image[:crop_h, :crop_w], cv2.COLOR_BGR2GRAY).mean()), 2)}
    detections = []
    for detection in frame['detections']:
        b = detection['box']
        # Boxes are normalized to the transformed image; clip to the crop before mapping back.
        bx0, by0 = min(crop_w, b['x']*space_w), min(crop_h, b['y']*space_h)
        bx1, by1 = min(crop_w, (b['x']+b['width'])*space_w), min(crop_h, (b['y']+b['height'])*space_h)
        if bx1 <= bx0 or by1 <= by0:
            continue
        detection['box'] = {'x': (x0+bx0)/original_w, 'y': (y0+by0)/original_h, 'width': (bx1-bx0)/original_w, 'height': (by1-by0)/original_h}
        detections.append(detection)
    frame['detections'] = detections
    return {'operation': operation, 'coordinate_space': 'original_image', 'preview_space': 'transformed_image', 'result': result, 'limitations': ['Enhancement does not recover missing detail; detector scores are not calibrated probabilities.']}
