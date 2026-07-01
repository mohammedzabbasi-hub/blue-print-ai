#!/usr/bin/env python3
"""BluePrintAI media analyzer bridge for the Shopify app.

This is an adapted, self-contained bridge based on the original
BLUEPRINTAIBACKEND/video_analysis_engine pipeline. It extracts video metadata,
key frames, optional audio, transcript availability, OCR text, and heuristic
creative scores, then returns JSON to the React Router server action.
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class VideoMetadata:
    filename: str
    path: str
    size_bytes: int
    duration_seconds: float
    width: int
    height: int
    fps: float
    aspect_ratio: str


@dataclass
class FrameData:
    timestamp_seconds: float
    image_path: str


@dataclass
class OCRTextItem:
    timestamp_seconds: float
    text: str
    image_path: str


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: media_analyzer_bridge.py <video_path> <work_dir>"}))
        return 2

    video_path = Path(sys.argv[1])
    work_dir = Path(sys.argv[2])

    try:
        result = run_full_video_analysis(video_path, work_dir)
    except Exception as exc:
        result = build_unreadable_video_analysis(video_path, exc)

    print(json.dumps(result))
    return 0


def run_full_video_analysis(video_path: Path, work_dir: Path) -> dict:
    metadata = extract_video_metadata(video_path)
    frames = extract_key_frames(video_path, work_dir / "frames")
    audio = extract_audio(video_path, work_dir / "audio")
    transcript = transcribe_audio(audio)
    ocr_text = extract_ocr_text(frames)
    analysis = build_heuristic_analysis(metadata, frames, transcript, ocr_text)

    return {
        "metadata": asdict(metadata),
        "frames": [asdict(frame) for frame in frames],
        "transcript": transcript,
        "ocr_text": [asdict(item) for item in ocr_text],
        "analysis": analysis,
        "fallback": False,
        "pipeline": {
            "metadata": True,
            "frames": len(frames) > 0,
            "audio": audio.exists(),
            "transcript": bool(transcript.get("full_text")),
            "ocr": len(ocr_text) > 0,
        },
    }


def extract_video_metadata(video_path: Path) -> VideoMetadata:
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    frame_count = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_seconds = frame_count / fps if fps > 0 else 0.0
    cap.release()

    return VideoMetadata(
        filename=video_path.name,
        path=str(video_path),
        size_bytes=video_path.stat().st_size,
        duration_seconds=round(duration_seconds, 2),
        width=width,
        height=height,
        fps=round(fps, 2),
        aspect_ratio=format_aspect_ratio(width, height),
    )


def extract_key_frames(
    video_path: Path,
    output_root: Path,
    interval_seconds: int = 2,
    max_frames: int = 8,
) -> list[FrameData]:
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    if fps <= 0:
        cap.release()
        raise ValueError("Invalid FPS; cannot extract frames.")

    frame_step = max(1, int(fps * interval_seconds))
    output_dir = output_root / video_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)

    frames: list[FrameData] = []
    current_frame = 0
    saved_count = 0

    while cap.isOpened() and saved_count < max_frames:
        success, frame = cap.read()
        if not success:
            break

        if current_frame % frame_step == 0:
            timestamp = current_frame / fps
            image_path = output_dir / f"frame_{saved_count:03d}.jpg"
            cv2.imwrite(str(image_path), frame)
            frames.append(FrameData(round(timestamp, 2), str(image_path)))
            saved_count += 1

        current_frame += 1

    cap.release()
    return frames


def extract_audio(video_path: Path, output_root: Path) -> Path:
    output_dir = output_root / video_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = output_dir / f"{video_path.stem}.wav"

    if shutil.which("ffmpeg") is None:
        return audio_path

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(audio_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        no_audio_markers = [
            "Output file does not contain any stream",
            "Stream map 'a' matches no streams",
            "does not contain any stream",
        ]
        if any(marker in result.stderr for marker in no_audio_markers):
            return audio_path
        return audio_path

    return audio_path


def transcribe_audio(audio_path: Path) -> dict:
    if not audio_path.exists():
        return {
            "full_text": "",
            "segments": [],
            "available": False,
            "unavailable_reason": "No audio track was extracted, or ffmpeg is unavailable.",
        }

    # Keep the Shopify app deploy-safe: do not require Google Speech credentials.
    # The original backend uses Google Cloud Speech here when configured.
    return {
        "full_text": "",
        "segments": [],
        "available": False,
        "unavailable_reason": "Speech transcription is not configured in this Shopify app runtime.",
    }


def extract_ocr_text(frames: list[FrameData]) -> list[OCRTextItem]:
    try:
        import pytesseract
        from PIL import Image
    except Exception:
        return []

    results: list[OCRTextItem] = []

    for frame in frames:
        try:
            text = pytesseract.image_to_string(Image.open(frame.image_path), lang="eng").strip()
            if text:
                results.append(OCRTextItem(frame.timestamp_seconds, text, frame.image_path))
        except Exception:
            continue

    return results


def build_heuristic_analysis(
    metadata: VideoMetadata,
    frames: list[FrameData],
    transcript: dict,
    ocr_text: list[OCRTextItem],
) -> dict:
    transcript_text = (transcript.get("full_text") or "").strip()
    on_screen_text = " ".join(item.text for item in ocr_text).strip()
    combined_text = f"{transcript_text} {on_screen_text}".lower()
    duration = float(metadata.duration_seconds or 0)

    has_cta = any(token in combined_text for token in ["shop now", "buy now", "tap", "link", "order", "get yours"])
    has_benefit = any(token in combined_text for token in ["because", "helps", "without", "results", "save", "easy", "fast"])
    has_product_format = metadata.width > 0 and metadata.height > 0 and len(frames) > 0
    is_short = duration > 0 and duration <= 35

    hook_score = clamp_score(5 + (2 if is_short else 0) + (1 if has_product_format else 0))
    clarity_score = clamp_score(4 + (2 if has_benefit else 0) + (2 if on_screen_text else 0) + (1 if len(frames) >= 3 else 0))
    cta_score = clamp_score(4 + (3 if has_cta else 0) + (1 if on_screen_text else 0))

    strengths = [
        f"Extracted {len(frames)} key frame{'s' if len(frames) != 1 else ''} for visual review.",
        f"Detected video metadata: {metadata.width}x{metadata.height}, {metadata.duration_seconds}s, {metadata.aspect_ratio}.",
    ]
    if on_screen_text:
        strengths.append("Detected on-screen text with OCR.")
    if transcript_text:
        strengths.append("Speech transcript text was available for review.")

    weaknesses = []
    if not on_screen_text:
        weaknesses.append("No readable on-screen text was detected in sampled frames.")
    if not has_cta:
        weaknesses.append("No clear CTA language was detected in the available OCR or transcript evidence.")
    if duration > 45:
        weaknesses.append("The video may be long for a cold-traffic creative test.")

    recommendations = [
        "Keep the product, main problem, or desired result visible inside the first two seconds.",
        "Add a clear on-screen CTA before second 10 if the current cut does not show one.",
        "Use OCR-visible benefit text so the message works even when audio is muted.",
    ]
    if duration > 35:
        recommendations.append("Create a shorter 15-35 second cut for paid social testing.")

    return {
        "analysis_method": "heuristic",
        "hook_score": hook_score,
        "cta_score": cta_score,
        "clarity_score": clarity_score,
        "creator_style": "Frame/audio/OCR heuristic review",
        "strengths": strengths,
        "weaknesses": weaknesses or ["No major structural issue was detected from the sampled metadata and frames."],
        "recommendations": recommendations,
        "summary": (
            "BlueprintAI ran the media analyzer pipeline: video metadata extraction, key-frame sampling, "
            "audio extraction, OCR scanning, and heuristic creative scoring."
        ),
    }


def build_unreadable_video_analysis(video_path: Path, error: Exception) -> dict:
    return {
        "metadata": {
            "filename": video_path.name,
            "path": str(video_path),
            "size_bytes": video_path.stat().st_size if video_path.exists() else 0,
            "duration_seconds": 0,
            "width": 0,
            "height": 0,
            "fps": 0,
            "aspect_ratio": "unknown",
        },
        "frames": [],
        "transcript": {"full_text": "", "segments": []},
        "ocr_text": [],
        "error": "The media analyzer could not inspect this file.",
        "fallback": True,
        "fallback_reason": str(error),
        "pipeline": {"metadata": False, "frames": False, "audio": False, "transcript": False, "ocr": False},
    }


def format_aspect_ratio(width: int, height: int) -> str:
    if not width or not height:
        return "unknown"

    divisor = math.gcd(width, height)
    return f"{width // divisor}:{height // divisor}"


def clamp_score(value: int) -> int:
    return max(1, min(10, int(value)))


if __name__ == "__main__":
    raise SystemExit(main())
