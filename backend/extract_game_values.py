#!/usr/bin/env python3
"""Use PaddleOCR to read numbers after 现金、获得经验、储备金 in testimage.png."""
from pathlib import Path
import re
import sys
from typing import Dict, List, Optional

from paddleocr import PaddleOCR


KEYWORDS = ["现金", "获得经验", "储备金"]


def extract_number(text: str) -> Optional[str]:
    """Return the first numeric token in the string."""
    match = re.search(r"[-+]?\d+(?:[.,]\d+)*", text)
    if not match:
        return None
    return match.group(0).replace(",", "")


def find_neighbor_value(idx: int, entries: List[Dict[str, object]]) -> Optional[str]:
    """Pick the nearest numeric box to the right of the keyword box."""
    ref = entries[idx]
    ref_y = ref["center"][1]
    ref_h = ref["height"]
    candidates = []
    for j, cand in enumerate(entries):
        if j == idx:
            continue
        num = extract_number(cand["text"])
        if not num:
            continue
        if cand["center"][0] <= ref["center"][0]:
            continue
        if abs(cand["center"][1] - ref_y) > max(ref_h, cand["height"]) * 0.6:
            continue
        dx = cand["center"][0] - ref["center"][0]
        candidates.append((dx, -cand["score"], num))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][2]


def extract_values(image_path: Path) -> Dict[str, Optional[str]]:
    # Use Chinese OCR models; defaults to CPU in this environment.
    ocr = PaddleOCR(lang="ch")
    result = ocr.ocr(str(image_path))
    ocr_res = result[0] if result else None

    entries: List[Dict[str, object]] = []
    if ocr_res:
        texts = ocr_res["rec_texts"]
        scores = ocr_res["rec_scores"]
        polys = ocr_res["rec_polys"]
        for text, score, poly in zip(texts, scores, polys):
            xs = [float(p[0]) for p in poly]
            ys = [float(p[1]) for p in poly]
            entries.append(
                {
                    "text": str(text).strip(),
                    "score": float(score),
                    "center": (sum(xs) / len(xs), sum(ys) / len(ys)),
                    "height": max(ys) - min(ys),
                }
            )

    values: Dict[str, Optional[str]] = {k: None for k in KEYWORDS}
    for idx, entry in enumerate(entries):
        for keyword in KEYWORDS:
            if keyword not in entry["text"]:
                continue
            after_keyword = entry["text"].split(keyword, 1)[1]
            value = extract_number(after_keyword) or extract_number(entry["text"])
            if not value:
                value = find_neighbor_value(idx, entries)
            if value:
                values[keyword] = value
    return values


def main() -> None:
    if len(sys.argv) > 1:
        image_path = Path(sys.argv[1]).expanduser()
    else:
        # Default to the test image next to this script.
        image_path = Path(__file__).resolve().parent / "testimage.png"
    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")

    values = extract_values(image_path)
    for keyword in KEYWORDS:
        print(f"{keyword}: {values.get(keyword) or '未识别'}")


if __name__ == "__main__":
    main()
