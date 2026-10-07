import pytest
import torch
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.services.ai_service import build_densenet121, CHEST_XRAY_LABELS

def test_model_architecture():
    """Verify DenseNet121 model builds with correct 14-class classifier head."""
    model = build_densenet121(num_classes=14)
    assert model is not None

    # Verify output dimension with dummy batch
    dummy_input = torch.randn(2, 3, 224, 224)
    model.eval()
    with torch.no_grad():
        output = model(dummy_input)

    assert output.shape == (2, 14)
    # Output should be sigmoid probabilities between 0 and 1
    assert torch.all(output >= 0.0) and torch.all(output <= 1.0)
    assert len(CHEST_XRAY_LABELS) == 14
