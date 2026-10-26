# AutoVision console gallery — final submission assets

Open `index.html` locally to browse, or view the numbered PNGs directly on GitHub. Images are 1440×960 (3:2), each below 5 MB, captured with Playwright from the signed-in localhost application.

| Image | What it demonstrates |
| --- | --- |
| 01 | Manual upload and AI consent control |
| 02 | Real saved local job history, source, actor and duration |
| 03 | Actual analysis report and retained video samples |
| 04 | A selected later frame with OpenCV detections and measured statistics |
| 05 | Organization object categories and detection presets |
| 06 | Enabling enhanced inspection, trigger labels and follow-up budget |
| 07 | Approved planner, scene, package and activity model selectors |
| 08 | OpenCV low-light tool, brightness threshold and CLAHE strength |
| 09 | Crop/re-detection tool and padding control |

The local Bedrock model was **not configured**. Its warning remains visible. A fresh OpenCV-only video analysis ran successfully; no fresh successful Bedrock agent loop is claimed. The inspection default was temporarily saved for the screenshots and restored afterward. Only bundled public demo media was used; no production credentials or customer footage appear.

Capture metadata and captions are in `manifest.json`. Reproduce using `devops/testing/capture-console-gallery.cjs`, `AUTOVISION_TEST_URL` for a localhost origin, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for the installed browser, and `AUTOVISION_GALLERY_DIR=docs/console-gallery-final`. The script creates a real local job and temporarily changes/restores the local inspection default.

Additional Devpost gallery assets: [AWS stack](../../public/aws-stack.png), [agent loop](../../public/agent-flow.png), and [project thumbnail](../../public/brand/autovision-devpost-1200x800.png).
