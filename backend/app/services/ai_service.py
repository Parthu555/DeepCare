"""
AI Inference Service — DenseNet121 chest X-ray classification with Grad-CAM.
Modular pipeline: load model → preprocess → infer → grad-cam → store results.
"""
import io
import logging
import os
import time
import uuid
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

from app.core.config import settings
from app.services.s3_service import (
    download_s3_object,
    upload_file_to_s3,
    build_gradcam_s3_key,
)
from app.services.cloudwatch_service import record_inference_duration

logger = logging.getLogger(__name__)

# NIH ChestX-ray14 labels
CHEST_XRAY_LABELS = [
    "Atelectasis",
    "Cardiomegaly",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pneumonia",
    "Pneumothorax",
    "Consolidation",
    "Edema",
    "Emphysema",
    "Fibrosis",
    "Pleural_Thickening",
    "Hernia",
]

_model: Optional[nn.Module] = None
_model_loaded: bool = False
_device: str = "cpu"


def build_densenet121(num_classes: int = 14) -> nn.Module:
    """Build DenseNet121 with custom classifier for multi-label chest X-ray classification."""
    model = models.densenet121(weights=None)
    # Replace classifier head
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, num_classes),
        nn.Sigmoid(),  # Multi-label output
    )
    return model


def load_model(force_reload: bool = False) -> Optional[nn.Module]:
    """Load the trained DenseNet121 model from disk or S3."""
    global _model, _model_loaded, _device

    if _model_loaded and not force_reload:
        return _model

    _device = settings.ML_DEVICE
    if torch.cuda.is_available() and _device == "auto":
        _device = "cuda"
        logger.info("CUDA available — using GPU inference.")
    else:
        _device = "cpu"
        logger.info("Using CPU inference.")

    model_path = settings.ML_MODEL_PATH

    # Try to download from S3 if not on disk
    if not os.path.exists(model_path) and settings.S3_MODEL_KEY:
        logger.info(f"Model not found locally. Downloading from S3: {settings.S3_MODEL_KEY}")
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        model_bytes = download_s3_object(settings.S3_MODEL_KEY)
        if model_bytes:
            with open(model_path, "wb") as f:
                f.write(model_bytes)
            logger.info(f"Model downloaded to {model_path}")

    if not os.path.exists(model_path):
        logger.warning(
            f"Model file not found at {model_path}. "
            "AI inference is UNAVAILABLE. Upload a trained model to enable analysis."
        )
        _model = None
        _model_loaded = False
        return None

    try:
        _model = build_densenet121(num_classes=len(CHEST_XRAY_LABELS))
        state_dict = torch.load(model_path, map_location=_device)
        # Handle DataParallel wrapped models
        if any(k.startswith("module.") for k in state_dict.keys()):
            state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
        _model.load_state_dict(state_dict)
        _model.to(_device)
        _model.eval()
        _model_loaded = True
        logger.info(f"DenseNet121 model loaded from {model_path} on {_device}")
        return _model
    except Exception as e:
        logger.error(f"Failed to load AI model: {e}")
        _model = None
        _model_loaded = False
        return None


def preprocess_image(image_bytes: bytes) -> Optional[torch.Tensor]:
    """Preprocess a chest X-ray image (DICOM, PNG, or JPEG) for DenseNet121 inference."""
    try:
        # Check if DICOM
        is_dicom = False
        if len(image_bytes) > 132 and image_bytes[128:132] == b"DICM":
            is_dicom = True

        if is_dicom:
            try:
                import pydicom
                ds = pydicom.dcmread(io.BytesIO(image_bytes))
                pixels = ds.pixel_array.astype(float)
                # Rescale window to 0-255
                p_min, p_max = pixels.min(), pixels.max()
                if p_max > p_min:
                    pixels = (pixels - p_min) / (p_max - p_min) * 255.0
                image = Image.fromarray(pixels.astype(np.uint8)).convert("RGB")
            except Exception as dcm_err:
                logger.warning(f"pydicom read failed, falling back to PIL: {dcm_err}")
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        else:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])
        tensor = transform(image).unsqueeze(0)  # Add batch dimension
        return tensor
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        return None


def run_inference(image_bytes: bytes) -> Optional[Dict[str, float]]:
    """Run DenseNet121 inference on image bytes. Returns label → probability dict."""
    model = load_model()
    if model is None:
        return None

    tensor = preprocess_image(image_bytes)
    if tensor is None:
        return None

    try:
        tensor = tensor.to(_device)
        with torch.no_grad():
            output = model(tensor)
        probs = output.squeeze().cpu().numpy()
        return {
            label: float(prob)
            for label, prob in zip(CHEST_XRAY_LABELS, probs)
        }
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        return None


class GradCAM:
    """Gradient-weighted Class Activation Mapping for DenseNet121."""

    def __init__(self, model: nn.Module, target_layer: str = "features.denseblock4"):
        self.model = model
        self.gradients = None
        self.activations = None
        self._register_hooks(target_layer)

    def _register_hooks(self, layer_name: str):
        for name, module in self.model.named_modules():
            if name == layer_name:
                module.register_forward_hook(self._save_activations)
                module.register_backward_hook(self._save_gradients)
                break

    def _save_activations(self, module, input, output):
        self.activations = output.detach()

    def _save_gradients(self, module, grad_in, grad_out):
        self.gradients = grad_out[0].detach()

    def generate(
        self, image_tensor: torch.Tensor, class_idx: int, original_size: Tuple[int, int]
    ) -> Optional[np.ndarray]:
        """Generate a Grad-CAM heatmap for the given class index."""
        try:
            self.model.zero_grad()
            image_tensor = image_tensor.to(_device)
            image_tensor.requires_grad_(True)
            output = self.model(image_tensor)

            # Backprop for target class
            one_hot = torch.zeros_like(output)
            one_hot[0, class_idx] = 1
            output.backward(gradient=one_hot)

            if self.gradients is None or self.activations is None:
                return None

            # Pool gradients
            weights = self.gradients.mean(dim=(2, 3), keepdim=True)
            cam = (weights * self.activations).sum(dim=1, keepdim=True)
            cam = torch.relu(cam)
            cam = cam.squeeze().cpu().numpy()

            # Normalize
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

            # Resize to original image size
            from PIL import Image as PILImage
            cam_pil = PILImage.fromarray((cam * 255).astype(np.uint8))
            cam_pil = cam_pil.resize(original_size, PILImage.BILINEAR)
            return np.array(cam_pil)
        except Exception as e:
            logger.error(f"GradCAM generation failed: {e}")
            return None


def generate_gradcam_overlay(
    image_bytes: bytes, class_idx: int
) -> Optional[bytes]:
    """Generate a Grad-CAM heatmap and overlay on the original image."""
    try:
        import cv2

        model = load_model()
        if model is None:
            return None

        original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        orig_size = (original_image.width, original_image.height)
        orig_array = np.array(original_image)

        tensor = preprocess_image(image_bytes)
        if tensor is None:
            return None

        gradcam = GradCAM(model)
        heatmap = gradcam.generate(tensor, class_idx, orig_size)
        if heatmap is None:
            return None

        # Apply colormap and overlay
        heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        overlay = cv2.addWeighted(orig_array, 0.6, heatmap_rgb, 0.4, 0)

        # Encode to PNG bytes
        overlay_pil = Image.fromarray(overlay)
        buf = io.BytesIO()
        overlay_pil.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        logger.error(f"GradCAM overlay generation failed: {e}")
        return None


def analyze_xray(
    image_bytes: bytes,
    patient_id: str,
    analysis_id: str,
    generate_gradcam: bool = True,
) -> Dict:
    """
    Full analysis pipeline:
    1. Preprocess image
    2. Run DenseNet121 inference
    3. Optionally generate Grad-CAM
    4. Store Grad-CAM to S3
    5. Return structured result
    """
    start_time = time.monotonic()
    result = {
        "status": "failed",
        "model_name": settings.ML_MODEL_NAME,
        "model_version": settings.ML_MODEL_VERSION,
        "predictions": None,
        "confidence_scores": None,
        "top_prediction": None,
        "top_confidence": None,
        "gradcam_s3_key": None,
        "inference_duration_ms": None,
        "error_message": None,
    }

    # Check model availability
    model = load_model()
    if model is None:
        result["error_message"] = (
            "AI model is not available. Please contact the system administrator "
            "to upload a trained model file."
        )
        return result

    # Run inference
    predictions = run_inference(image_bytes)
    if predictions is None:
        result["error_message"] = "Inference failed during image processing."
        return result

    # Sort by confidence
    sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
    top_label, top_conf = sorted_preds[0]

    result["predictions"] = predictions
    result["confidence_scores"] = predictions
    result["top_prediction"] = top_label
    result["top_confidence"] = top_conf
    result["status"] = "completed"

    # Generate and store Grad-CAM
    if generate_gradcam and top_conf > settings.ML_CONFIDENCE_THRESHOLD:
        class_idx = CHEST_XRAY_LABELS.index(top_label)
        gradcam_bytes = generate_gradcam_overlay(image_bytes, class_idx)
        if gradcam_bytes:
            gradcam_key = build_gradcam_s3_key(patient_id, analysis_id)
            uploaded = upload_file_to_s3(
                gradcam_bytes,
                gradcam_key,
                content_type="image/png",
                metadata={
                    "analysis_id": analysis_id,
                    "patient_id": patient_id,
                    "type": "gradcam_heatmap",
                },
            )
            if uploaded:
                result["gradcam_s3_key"] = gradcam_key

    duration_ms = (time.monotonic() - start_time) * 1000
    result["inference_duration_ms"] = duration_ms

    # Emit CloudWatch metric
    record_inference_duration(duration_ms, settings.ML_MODEL_NAME)

    logger.info(
        f"X-ray analysis complete | analysis_id={analysis_id} | "
        f"top={top_label} ({top_conf:.3f}) | duration={duration_ms:.1f}ms"
    )
    return result


def get_model_status() -> Dict:
    """Return current model loading status — used by health checks."""
    model = load_model()
    return {
        "model_available": model is not None,
        "model_name": settings.ML_MODEL_NAME,
        "model_version": settings.ML_MODEL_VERSION,
        "model_path": settings.ML_MODEL_PATH,
        "device": _device,
        "labels": CHEST_XRAY_LABELS,
    }
