"""Reproducible synthetic motion evaluation, not object-detector accuracy."""
import json
import platform
import statistics
import numpy as np
import cv2
from server import analyze
from test_server import frame

cases = []
for name, fraction in [("static", 0), ("small_patch", 0.05), ("large_patch", 0.5), ("lighting_change", 1)]:
    before = np.zeros((180, 320, 3), np.uint8)
    after = before.copy()
    after[:, :round(320 * fraction)] = 255
    runs = [analyze({"frames": [frame(before, 0), frame(after, 1000)]}) for _ in range(5)]
    motion = runs[-1]["observations"][1]
    cases.append({"case": name, "expected_changed_fraction": fraction, "measured_fraction": motion["value"], "detected": motion["detected"], "latency_ms_median": statistics.median(r["metrics"]["latency_ms"] for r in runs)})
    assert abs(motion["value"] - fraction) < 0.001
    assert motion["detected"] == (fraction > 0.01)
print(json.dumps({"opencv_version": cv2.__version__, "platform": platform.machine(), "runs_per_case": 5, "cases": cases, "limitations": ["Synthetic changed-pixel test, not real-world object accuracy.", "Lighting changes also trigger motion; motion is not an intruder classification.", "Legacy HOG false positives/negatives and Nova grounding require separate representative evaluation."]}, indent=2))
