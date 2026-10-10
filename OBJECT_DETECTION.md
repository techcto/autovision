# Object detection and history

Settings → Object detection saves an organization-scoped AI label selection. REST and MCP inherit it, or override with `detection_labels: ["dog", "package"]` and `classify: true`. An empty list requests no AI object categories. SmartDetector defaults select people, pets, common vehicles, and packages; transport and all-category presets are available.

The catalog contains [COCO's 80 object categories](https://cocodataset.org/dataset/detection-2017.htm) plus package, smoke, and fire. It is a vocabulary, **not an installed 80-class OpenCV detector**. OpenCV currently measures motion and pedestrians independently. Optional Bedrock grounding supplies approximate selected-category boxes on first/middle/last samples, marked `source: bedrock`, `advisory: true`, with no confidence score. Accuracy across the expanded vocabulary is not independently benchmarked. More labels can increase AI prompt/output work; fewer labels do not reduce the internal compute of a fixed neural detector.

New private jobs retain up to 12 small aspect-preserving JPEG previews, observations and detection boxes for seven days. Original video is not retained. Job detail supports stepping through samples. Older missing samples cannot be reconstructed. Public anonymous analyses are not saved as private jobs.

Settings → Clear analysis history permanently deletes the active organization's jobs, results, thumbnails, and sampled previews. Root/admin authorization and typing `CLEAR HISTORY` are required. Users, keys, devices, settings, and quota counters remain. New/in-progress analyses may appear afterward. Exported client copies and infrastructure backups are outside this purge.

For additional trained detectors, provision licensed versioned weights, map their classes into the catalog, emit normalized boxes with model/version provenance, and evaluate representative held-out footage. [OpenCV DNN examples](https://github.com/opencv/opencv/blob/4.x/samples/dnn/README.md) require model weights; OpenCV alone does not supply universal object detection. Smoke/fire must not be used as life-safety alarms.

COOL/Graviton acceleration is not implemented or claimed by this feature. Award eligibility requires running the actual core workload with COOL on the Arm path and publishing a reproducible baseline comparison.
