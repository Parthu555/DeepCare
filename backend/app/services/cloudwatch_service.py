"""
CloudWatch Service — metrics, log emission, custom dashboard creation.
Emits application-level metrics without logging PII or medical data.
"""
import logging
import time
from datetime import datetime
from functools import wraps
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_cloudwatch_client():
    kwargs = {"region_name": settings.AWS_REGION}
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("cloudwatch", **kwargs)


def get_logs_client():
    kwargs = {"region_name": settings.AWS_REGION}
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("logs", **kwargs)


def put_metric(
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[List[Dict[str, str]]] = None,
    namespace: Optional[str] = None,
) -> bool:
    """Emit a custom metric to CloudWatch."""
    if not settings.CLOUDWATCH_ENABLED:
        logger.debug(f"CloudWatch disabled; metric '{metric_name}' = {value} skipped.")
        return True
    namespace = namespace or settings.CLOUDWATCH_METRICS_NAMESPACE
    cw = get_cloudwatch_client()
    metric_data = {
        "MetricName": metric_name,
        "Value": value,
        "Unit": unit,
        "Timestamp": datetime.utcnow(),
    }
    if dimensions:
        metric_data["Dimensions"] = dimensions
    try:
        cw.put_metric_data(Namespace=namespace, MetricData=[metric_data])
        return True
    except (ClientError, NoCredentialsError) as e:
        logger.warning(f"Failed to put CloudWatch metric '{metric_name}': {e}")
        return False


def record_api_request(
    endpoint: str, method: str, status_code: int, duration_ms: float
) -> None:
    """Record API request count and latency metrics."""
    dimensions = [
        {"Name": "Endpoint", "Value": endpoint},
        {"Name": "Method", "Value": method},
    ]
    put_metric("APIRequestCount", 1.0, "Count", dimensions)
    put_metric("APIResponseLatencyMs", duration_ms, "Milliseconds", dimensions)
    if status_code >= 500:
        put_metric("APIServerErrors", 1.0, "Count", dimensions)
    elif status_code >= 400:
        put_metric("APIClientErrors", 1.0, "Count", dimensions)


def record_inference_duration(duration_ms: float, model_name: str) -> None:
    """Record AI inference duration."""
    dimensions = [{"Name": "ModelName", "Value": model_name}]
    put_metric("AIInferenceDurationMs", duration_ms, "Milliseconds", dimensions)
    put_metric("AIInferenceCount", 1.0, "Count", dimensions)


def record_xray_upload(success: bool) -> None:
    """Record X-ray upload event (no patient data in metric name)."""
    put_metric("XrayUploads", 1.0, "Count")
    if not success:
        put_metric("XrayUploadErrors", 1.0, "Count")


def record_auth_event(event_type: str, success: bool) -> None:
    """Record authentication events without PII."""
    dimensions = [{"Name": "EventType", "Value": event_type}]
    put_metric("AuthEvents", 1.0, "Count", dimensions)
    if not success:
        put_metric("FailedAuthAttempts", 1.0, "Count", dimensions)


def emit_log(log_group: str, log_stream: str, message: str) -> None:
    """Emit a log event to a CloudWatch Logs log group."""
    if not settings.CLOUDWATCH_ENABLED:
        return
    logs_client = get_logs_client()
    try:
        # Ensure stream exists
        try:
            logs_client.create_log_stream(
                logGroupName=log_group, logStreamName=log_stream
            )
        except ClientError as e:
            if e.response["Error"]["Code"] != "ResourceAlreadyExistsException":
                raise

        logs_client.put_log_events(
            logGroupName=log_group,
            logStreamName=log_stream,
            logEvents=[
                {
                    "timestamp": int(time.time() * 1000),
                    "message": message,
                }
            ],
        )
    except (ClientError, NoCredentialsError) as e:
        logger.warning(f"CloudWatch log emission failed: {e}")


def create_deepcare_dashboard() -> bool:
    """Create or update the DeepCare CloudWatch monitoring dashboard."""
    if not settings.CLOUDWATCH_ENABLED:
        logger.info("CloudWatch disabled; skipping dashboard creation.")
        return True

    region = settings.AWS_REGION
    namespace = settings.CLOUDWATCH_METRICS_NAMESPACE
    instance_id = _get_instance_id()

    dashboard_body = {
        "widgets": [
            {
                "type": "metric",
                "properties": {
                    "title": "EC2 CPU Utilization",
                    "metrics": [
                        ["AWS/EC2", "CPUUtilization", "InstanceId", instance_id]
                    ] if instance_id else [["AWS/EC2", "CPUUtilization"]],
                    "period": 300,
                    "stat": "Average",
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 0, "y": 0, "width": 12, "height": 6,
            },
            {
                "type": "metric",
                "properties": {
                    "title": "API Request Volume & Errors",
                    "metrics": [
                        [namespace, "APIRequestCount"],
                        [namespace, "APIServerErrors"],
                        [namespace, "APIClientErrors"],
                    ],
                    "period": 300,
                    "stat": "Sum",
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 12, "y": 0, "width": 12, "height": 6,
            },
            {
                "type": "metric",
                "properties": {
                    "title": "API Response Latency (ms)",
                    "metrics": [
                        [namespace, "APIResponseLatencyMs", {"stat": "p99"}],
                        [namespace, "APIResponseLatencyMs", {"stat": "p50"}],
                    ],
                    "period": 300,
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 0, "y": 6, "width": 12, "height": 6,
            },
            {
                "type": "metric",
                "properties": {
                    "title": "AI Inference Duration (ms)",
                    "metrics": [
                        [namespace, "AIInferenceDurationMs", {"stat": "Average"}],
                        [namespace, "AIInferenceCount", {"stat": "Sum"}],
                    ],
                    "period": 300,
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 12, "y": 6, "width": 12, "height": 6,
            },
            {
                "type": "metric",
                "properties": {
                    "title": "Authentication Events",
                    "metrics": [
                        [namespace, "AuthEvents", {"stat": "Sum"}],
                        [namespace, "FailedAuthAttempts", {"stat": "Sum"}],
                    ],
                    "period": 300,
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 0, "y": 12, "width": 12, "height": 6,
            },
            {
                "type": "metric",
                "properties": {
                    "title": "X-ray Uploads",
                    "metrics": [
                        [namespace, "XrayUploads", {"stat": "Sum"}],
                        [namespace, "XrayUploadErrors", {"stat": "Sum"}],
                    ],
                    "period": 300,
                    "region": region,
                    "view": "timeSeries",
                },
                "x": 12, "y": 12, "width": 12, "height": 6,
            },
        ]
    }

    import json
    cw = get_cloudwatch_client()
    try:
        cw.put_dashboard(
            DashboardName="DeepCare-Infrastructure",
            DashboardBody=json.dumps(dashboard_body),
        )
        logger.info("CloudWatch dashboard 'DeepCare-Infrastructure' created/updated.")
        return True
    except (ClientError, NoCredentialsError) as e:
        logger.error(f"Failed to create CloudWatch dashboard: {e}")
        return False


def create_cloudwatch_alarms(sns_topic_arn: Optional[str] = None) -> None:
    """Create standard CloudWatch alarms for DeepCare."""
    if not settings.CLOUDWATCH_ENABLED:
        return

    cw = get_cloudwatch_client()
    instance_id = _get_instance_id()
    alarm_actions = [sns_topic_arn] if sns_topic_arn else []

    alarms = []

    if instance_id:
        alarms += [
            {
                "AlarmName": "DeepCare-HighCPU",
                "AlarmDescription": "EC2 CPU utilization above 80%",
                "Namespace": "AWS/EC2",
                "MetricName": "CPUUtilization",
                "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                "Period": 300,
                "EvaluationPeriods": 2,
                "Threshold": 80.0,
                "ComparisonOperator": "GreaterThanThreshold",
                "Statistic": "Average",
                "AlarmActions": alarm_actions,
            },
        ]

    namespace = settings.CLOUDWATCH_METRICS_NAMESPACE
    alarms += [
        {
            "AlarmName": "DeepCare-HighAPIErrors",
            "AlarmDescription": "API server error rate elevated",
            "Namespace": namespace,
            "MetricName": "APIServerErrors",
            "Period": 300,
            "EvaluationPeriods": 2,
            "Threshold": 10.0,
            "ComparisonOperator": "GreaterThanThreshold",
            "Statistic": "Sum",
            "AlarmActions": alarm_actions,
        },
        {
            "AlarmName": "DeepCare-HighAuthFailures",
            "AlarmDescription": "Elevated authentication failures",
            "Namespace": namespace,
            "MetricName": "FailedAuthAttempts",
            "Period": 300,
            "EvaluationPeriods": 1,
            "Threshold": 20.0,
            "ComparisonOperator": "GreaterThanThreshold",
            "Statistic": "Sum",
            "AlarmActions": alarm_actions,
        },
    ]

    for alarm in alarms:
        try:
            cw.put_metric_alarm(**alarm)
            logger.info(f"CloudWatch alarm '{alarm['AlarmName']}' created/updated.")
        except (ClientError, NoCredentialsError) as e:
            logger.warning(f"Failed to create alarm '{alarm['AlarmName']}': {e}")


def _get_instance_id() -> Optional[str]:
    """Retrieve EC2 instance ID from metadata endpoint."""
    try:
        import urllib.request
        url = "http://169.254.169.254/latest/meta-data/instance-id"
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.read().decode()
    except Exception:
        return None


def timing_metric(metric_name: str):
    """Decorator to automatically time and emit a CloudWatch metric."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.monotonic()
            result = func(*args, **kwargs)
            duration_ms = (time.monotonic() - start) * 1000
            put_metric(metric_name, duration_ms, "Milliseconds")
            return result
        return wrapper
    return decorator
