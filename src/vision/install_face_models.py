"""Fetch pinned OpenCV Zoo weights and their notices at image build time."""
import hashlib
from pathlib import Path
import urllib.request

REVISION = '47534e27c9851bb1128ccc0102f1145e27f23f98'
MODELS = (
    ('yunet', 'face_detection_yunet', 'face_detection_yunet_2026may.onnx', 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0'),
    ('sface', 'face_recognition_sface', 'face_recognition_sface_2021dec.onnx', '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79'),
)


def install(destination):
    destination.mkdir(parents=True, exist_ok=True)
    for name, directory, filename, expected in MODELS:
        url = f'https://media.githubusercontent.com/media/opencv/opencv_zoo/{REVISION}/models/{directory}/{filename}'
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read(50 * 1024 * 1024 + 1)
        if len(data) > 50 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError(f'{name} model checksum mismatch')
        (destination / (name + '.onnx')).write_bytes(data)
        license_url = f'https://raw.githubusercontent.com/opencv/opencv_zoo/{REVISION}/models/{directory}/LICENSE'
        with urllib.request.urlopen(license_url, timeout=60) as response:
            notice = response.read(100000)
        (destination / (name + '-LICENSE')).write_bytes(notice)
    (destination / 'SOURCE.txt').write_text(f'OpenCV Zoo revision {REVISION}\nYuNet: MIT; SFace: Apache-2.0. See included license notices.\n')


if __name__ == '__main__':
    import sys
    install(Path(sys.argv[1]))
