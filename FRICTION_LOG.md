# AutoVision / OpenCV friction log

Observed development feedback, dated October 10, 2026 (America/New_York). No customer footage, credentials, account IDs or biometric references are included. This log is submission material, not an automatically submitted feedback form.

## AV-001 — Whole-person detection is not face recognition

- **Task attempted:** Reuse configured `person` detection for a consenting-household recognition workflow in SmartDetector.
- **Steps taken:** Reviewed the object catalog and existing analysis pipeline, then traced the requested family matching/notification behavior.
- **Expected result:** A clearly discoverable route from person detection to optional face measurements.
- **Actual result:** The catalog contained whole-object labels, not faces or identity measurements. Existing HOG boxes and scene grounding could not supply a household match.
- **Severity:** Medium — blocked the requested feature, not existing person/motion analysis.
- **Workaround used:** Added a separate stateless face-measurement endpoint using pinned YuNet/SFace models; kept galleries, names and consent in SmartDetector. Real OpenCV 5 inference passed a sample smoke check; household accuracy remains unvalidated.
- **Actionable suggestion:** Provide an OpenCV end-to-end reference distinguishing person detection, face detection, alignment, embeddings, gallery matching and consent/retention boundaries. Make model/dependency requirements explicit.

## AV-002 — Model provisioning and compatibility are separate from application code

- **Task attempted:** Prepare reproducible YuNet/SFace deployment inside the existing OpenCV vision container.
- **Steps taken:** Inspected OpenCV Zoo model documentation and the SFace licensing/provenance clarification issue; checked current container and runtime configuration.
- **Expected result:** A documented, pinned pair of weights with clear redistribution terms and runtime compatibility.
- **Actual result:** The app container did not contain either model. YuNet documentation distinguishes fixed-shape exports from the newer dynamic-input export for OpenCV 5. An upstream SFace clarification issue raises licensing/provenance questions; no legal conclusion or actual model-loading failure is claimed here.
- **Severity:** Medium — blocks enabling the new biometric path in production, not existing analysis.
- **Workaround used:** Selected the dynamic-input May 2026 YuNet export and pinned SFace with checksums to Zoo revision `47534e27c9851bb1128ccc0102f1145e27f23f98`. Added build-time download and upstream license notices (YuNet MIT, SFace Apache-2.0). Real OpenCV 5.0.0 inference detected one face and produced a 128-value embedding from an OpenCV sample. Missing/incompatible weights still fail explicitly; no runtime downloads occur. This is a compatibility smoke check, not recognition accuracy evidence.
- **Actionable suggestion:** Publish a versioned model manifest with runtime/export compatibility, checksums, licensing/provenance and deployment examples for Arm/x86 containers.
- **References:** [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet), [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface), [clarification issue](https://github.com/opencv/opencv_zoo/issues/313).

## AV-003 — Local verification environment could not write build metadata

- **Task attempted:** Run TypeScript verification and Python syntax compilation for the new endpoint.
- **Steps taken:** Ran `tsc --noEmit` and `python3 -m py_compile` from the project directories in the restricted execution environment.
- **Expected result:** Read-only checks complete without modifying the source tree.
- **Actual result:** TypeScript attempted to write `tsconfig.tsbuildinfo`; Python attempted to write `__pycache__`. Both were rejected because the repositories were mounted read-only in that execution context.
- **Severity:** Low — local tooling friction, not an OpenCV runtime defect.
- **Workaround used:** Ran TypeScript with `--incremental false`, Python AST parsing for syntax, and approved local build/test execution for generated artifacts.
- **Actionable suggestion:** Document a genuinely read-only verification command and distinguish syntax checks, mocked tests and actual model inference in reproducibility instructions.

## Submission and further entries

Attach sanitized failing commands/output and exact versions when available. Record future actual COOL/Graviton evaluations and model-inference errors separately; do not invent a benchmark, solved compatibility issue, or agentic-loop trace. For every entry keep: task, steps, expected/actual, severity, workaround and actionable suggestion.
