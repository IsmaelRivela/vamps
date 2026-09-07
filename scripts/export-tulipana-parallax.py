#!/usr/bin/env python3
"""Export fondotuli.psd layers for La Tulipana case parallax hero."""

from __future__ import annotations

import json
import os
from pathlib import Path

from psd_tools import PSDImage

PSD = Path("/Users/ismaelrivela/Desktop/fondotuli/fondotuli.psd")
OUT = Path(__file__).resolve().parents[1] / "assets/projects/tulipana/parallax"
CANVAS_W, CANVAS_H = 2560, 1600

LAYER_MAP = {
    "fondo": "fondo",
    "Cloud 3": "cloud-3",
    "Layer 4": "layer-4",
    "Layer 1": "layer-1",
    "Layer 2": "layer-2",
    "Layer 3": "layer-3",
    "Vector Smart Object": "logo",
    "Layer 5": "layer-5",
}


def bbox_pct(bbox: tuple[int, int, int, int]) -> dict:
    l, t, r, b = bbox
    return {
        "left": round(l / CANVAS_W * 100, 4),
        "top": round(t / CANVAS_H * 100, 4),
        "width": round((r - l) / CANVAS_W * 100, 4),
        "height": round((b - t) / CANVAS_H * 100, 4),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    psd = PSDImage.open(PSD)
    manifest: dict = {
        "canvas": {"width": CANVAS_W, "height": CANVAS_H, "aspect": CANVAS_W / CANVAS_H},
        "layers": [],
    }

    for layer in psd:
        slug = LAYER_MAP.get(layer.name)
        if not slug or not layer.visible:
            continue
        img = layer.composite()
        if img is None:
            print(f"skip {layer.name}: no raster")
            continue
        png_path = OUT / f"{slug}.png"
        img.save(png_path, optimize=True)
        entry = {
            "id": slug,
            "file": f"{slug}.webp",
            "bbox": list(layer.bbox),
            "placement": bbox_pct(layer.bbox),
        }
        manifest["layers"].append(entry)
        print(f"exported {slug}.png {img.size} bbox={layer.bbox}")

    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {manifest_path}")


if __name__ == "__main__":
    main()
