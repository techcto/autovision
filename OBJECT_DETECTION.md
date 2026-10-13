# Object detection and history

Settings → Object detection saves an organization-scoped label selection. REST and MCP inherit it, or override with `detection_labels: ["dog", "package"]`. An empty list requests only person detection. SmartDetector defaults select people, pets, common vehicles, and packages; transport and all-category presets are available.

The catalog contains [COCO's 80 object categories](https://cocodataset.org/dataset/detection-2017.htm) plus package, smoke, and fire. COCO categories are detected by a pinned OpenCV Zoo YOLOX model running in OpenCV 5 (`cv2.dnn`) on every sampled frame, independent of `classify`; person is always included. Boxes carry a detector `score`, which is not a calibrated probability. Package, smoke and fire use optional Bedrock grounding on first/middle/last samples with `classify: true`, marked `source: bedrock`, `advisory: true`, with no confidence score. Accuracy across the vocabulary is not independently benchmarked; see the README evaluation for observed failures. Fewer labels do not reduce the internal compute of the fixed neural detector.

New private jobs retain up to 12 small aspect-preserving JPEG previews, observations and detection boxes for seven days. Original video is not retained. Job detail supports stepping through samples. Older missing samples cannot be reconstructed. Public anonymous analyses are not saved as private jobs.

Settings → Clear analysis history permanently deletes the active organization's jobs, results, thumbnails, and sampled previews. Root/admin authorization and typing `CLEAR HISTORY` are required. Users, keys, devices, settings, and quota counters remain. New/in-progress analyses may appear afterward. Exported client copies and infrastructure backups are outside this purge.

For additional trained detectors, follow the YOLOX pattern: provision licensed versioned weights at build time with a checksum, map their classes into the catalog, emit normalized boxes with model/version provenance, and evaluate representative held-out footage. Smoke/fire must not be used as life-safety alarms.

COOL/Graviton acceleration is not implemented or claimed by this feature. Award eligibility requires running the actual core workload with COOL on the Arm path and publishing a reproducible baseline comparison.
