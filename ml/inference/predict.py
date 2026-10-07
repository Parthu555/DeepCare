"""
Standalone CLI inference utility for DeepCare DenseNet-121 model.
Usage:
    python ml/inference/predict.py --image path/to/chest_xray.png --output-cam path/to/output_cam.png
"""
import argparse
import sys
import os
import torch
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.services.ai_service import (
    build_densenet121,
    preprocess_image,
    generate_gradcam,
    overlay_heatmap_on_image,
    CHEST_XRAY_LABELS,
)

def run_inference(image_path: str, output_cam_path: str = None):
    print(f"Loading image: {image_path}")
    image = Image.open(image_path).convert("RGB")
    tensor = preprocess_image(image)

    model = build_densenet121(num_classes=14)
    model.eval()

    with torch.no_grad():
        preds = model(tensor)[0].numpy()

    print("\n--- Diagnostic Pathology Predictions ---")
    results = sorted(zip(CHEST_XRAY_LABELS, preds), key=lambda x: x[1], reverse=True)
    for label, prob in results:
        status = "⚠️ ELEVATED" if prob > 0.5 else "NORMAL"
        print(f"[{status}] {label:<20} {prob * 100:6.2f}%")

    top_label, top_prob = results[0]
    target_idx = CHEST_XRAY_LABELS.index(top_label)

    if output_cam_path:
        print(f"\nGenerating Grad-CAM heatmap for top condition: {top_label}...")
        cam_mask = generate_gradcam(model, tensor, target_class_idx=target_idx)
        overlay = overlay_heatmap_on_image(image, cam_mask)
        overlay.save(output_cam_path)
        print(f"Grad-CAM overlay saved to: {output_cam_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepCare Chest X-Ray Inference CLI")
    parser.add_argument("--image", type=str, required=True, help="Path to input chest radiograph")
    parser.add_argument("--output-cam", type=str, default=None, help="Path to save Grad-CAM heatmap overlay")
    args = parser.parse_args()

    run_inference(args.image, args.output_cam)
