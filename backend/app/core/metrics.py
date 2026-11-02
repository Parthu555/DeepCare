"""
DeepCare Cloud-Native Monitoring & Prometheus Instrumentation.
Provides custom Prometheus metrics for clinical AI inference, radiograph ingestion,
clinical appointments, and diagnostic reporting.
"""
import time
import logging
from typing import Optional
from prometheus_client import Counter, Histogram, Gauge

logger = logging.getLogger(__name__)

# ─── Clinical Radiograph Ingestion Metrics ─────────────────────────────────────
XRAY_SCANS_TOTAL = Counter(
    "deepcare_xray_scans_total",
    "Total number of chest radiographs ingested into DeepCare",
    ["source", "status"],  # source: 'manual_upload', 'storage_dataset'
)

# ─── DenseNet-121 AI Inference Metrics ─────────────────────────────────────────
AI_INFERENCES_TOTAL = Counter(
    "deepcare_ai_inferences_total",
    "Total number of AI diagnostic inferences executed",
    ["model", "status", "top_pathology"],
)

AI_INFERENCE_DURATION_SECONDS = Histogram(
    "deepcare_ai_inference_duration_seconds",
    "Latency of DenseNet-121 and Grad-CAM execution in seconds",
    ["model"],
    buckets=(0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0),
)

# ─── Healthcare & EHR Operations Metrics ───────────────────────────────────────
APPOINTMENTS_TOTAL = Counter(
    "deepcare_appointments_total",
    "Total appointments requested and scheduled across hospital departments",
    ["status", "department"],
)

REPORTS_GENERATED_TOTAL = Counter(
    "deepcare_reports_generated_total",
    "Total certified diagnostic medical reports created",
    ["status", "report_type"],
)

ACTIVE_USERS_GAUGE = Gauge(
    "deepcare_active_users",
    "Current registered active users in DeepCare healthcare platform",
    ["role"],
)

DATABASE_HEALTH_STATUS = Gauge(
    "deepcare_database_up",
    "PostgreSQL Database connectivity health indicator (1 = healthy, 0 = degraded)",
)


def record_xray_ingested(source: str = "storage_dataset", status: str = "success"):
    """Increment radiograph ingestion counter."""
    try:
        XRAY_SCANS_TOTAL.labels(source=source, status=status).inc()
    except Exception as e:
        logger.debug(f"Metrics record error: {e}")


def record_ai_inference(model: str, status: str, top_pathology: str, duration_seconds: float):
    """Record AI model inference count and latency histogram."""
    try:
        sanitized_pathology = top_pathology.replace(" ", "_") if top_pathology else "Normal"
        AI_INFERENCES_TOTAL.labels(
            model=model or "DenseNet-121",
            status=status,
            top_pathology=sanitized_pathology,
        ).inc()
        AI_INFERENCE_DURATION_SECONDS.labels(model=model or "DenseNet-121").observe(duration_seconds)
    except Exception as e:
        logger.debug(f"Metrics record error: {e}")


def record_appointment_created(department: str = "Pulmonology", status: str = "scheduled"):
    """Increment appointments created metric."""
    try:
        APPOINTMENTS_TOTAL.labels(status=status, department=department).inc()
    except Exception as e:
        logger.debug(f"Metrics record error: {e}")


def record_report_generated(report_type: str = "radiology", status: str = "approved"):
    """Increment diagnostic report generation counter."""
    try:
        REPORTS_GENERATED_TOTAL.labels(status=status, report_type=report_type).inc()
    except Exception as e:
        logger.debug(f"Metrics record error: {e}")

