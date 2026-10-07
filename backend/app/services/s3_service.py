"""
AWS S3 Service — secure upload, download, presigned URL generation.
Uses IAM instance role — no hardcoded credentials.
"""
import logging
import mimetypes
import os
import uuid
from datetime import datetime
from typing import Optional, Tuple
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types and extensions
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "application/dicom": [".dcm"],
}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": [".pdf"],
}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".dcm"}
MAX_FILE_SIZE_BYTES = settings.S3_MAX_FILE_SIZE_MB * 1024 * 1024


def get_s3_client():
    """Return boto3 S3 client. Uses instance profile in EC2, env vars locally or LocalStack endpoint."""
    kwargs = {"region_name": settings.AWS_REGION}
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("s3", **kwargs)


def build_xray_s3_key(patient_id: str, xray_uuid: str, filename: str) -> str:
    """Build a structured S3 key for an X-ray image."""
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    return f"patients/{patient_id}/xrays/{date_prefix}/{xray_uuid}{ext}"


def build_gradcam_s3_key(patient_id: str, analysis_id: str) -> str:
    """Build a structured S3 key for a GradCAM heatmap."""
    return f"patients/{patient_id}/gradcam/{analysis_id}_heatmap.png"


def build_report_s3_key(patient_id: str, report_id: str) -> str:
    """Build a structured S3 key for an approved PDF report."""
    return f"patients/{patient_id}/reports/{report_id}.pdf"


def validate_image_file(
    filename: str, content_type: str, file_size_bytes: int
) -> Tuple[bool, str]:
    """Validate that a file is a safe, supported medical image."""
    if file_size_bytes > MAX_FILE_SIZE_BYTES:
        return False, f"File too large. Maximum size is {settings.S3_MAX_FILE_SIZE_MB} MB."
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return False, f"Unsupported file extension: {ext}. Allowed: {ALLOWED_IMAGE_EXTENSIONS}"
    if content_type not in ALLOWED_IMAGE_TYPES and content_type not in ALLOWED_DOCUMENT_TYPES:
        return False, f"Unsupported content type: {content_type}"
    return True, "ok"


def upload_file_to_s3(
    file_data: bytes,
    s3_key: str,
    content_type: str = "image/jpeg",
    metadata: Optional[dict] = None,
    bucket: Optional[str] = None,
) -> bool:
    """Upload bytes to S3. Returns True on success."""
    bucket = bucket or settings.S3_BUCKET_NAME
    client = get_s3_client()
    try:
        extra_args = {
            "ContentType": content_type,
            "ServerSideEncryption": "AES256",
        }
        if metadata:
            extra_args["Metadata"] = {
                k: str(v) for k, v in metadata.items()
            }
        client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=file_data,
            **extra_args,
        )
        logger.info(f"Uploaded to S3: s3://{bucket}/{s3_key}")
        return True
    except ClientError as e:
        logger.error(f"S3 upload failed for key '{s3_key}': {e}")
        return False
    except NoCredentialsError:
        logger.error("No AWS credentials available for S3 upload.")
        return False


def generate_presigned_url(
    s3_key: str,
    expiry_seconds: Optional[int] = None,
    bucket: Optional[str] = None,
) -> Optional[str]:
    """Generate a presigned URL for reading an S3 object."""
    bucket = bucket or settings.S3_BUCKET_NAME
    expiry = expiry_seconds or settings.S3_PRESIGNED_URL_EXPIRY
    client = get_s3_client()
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": s3_key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError as e:
        logger.error(f"Failed to generate presigned URL for '{s3_key}': {e}")
        return None
    except NoCredentialsError:
        logger.error("No AWS credentials available for presigned URL.")
        return None


def generate_presigned_upload_url(
    s3_key: str,
    content_type: str,
    expiry_seconds: int = 300,
    max_content_length: int = MAX_FILE_SIZE_BYTES,
    bucket: Optional[str] = None,
) -> Optional[dict]:
    """Generate a presigned POST policy for direct client-side upload to S3."""
    bucket = bucket or settings.S3_BUCKET_NAME
    client = get_s3_client()
    try:
        response = client.generate_presigned_post(
            Bucket=bucket,
            Key=s3_key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_content_length],
            ],
            ExpiresIn=expiry_seconds,
        )
        return response
    except ClientError as e:
        logger.error(f"Failed to generate presigned POST for '{s3_key}': {e}")
        return None


def delete_s3_object(s3_key: str, bucket: Optional[str] = None) -> bool:
    """Soft-deletes or permanently deletes an S3 object."""
    bucket = bucket or settings.S3_BUCKET_NAME
    client = get_s3_client()
    try:
        client.delete_object(Bucket=bucket, Key=s3_key)
        logger.info(f"Deleted S3 object: {s3_key}")
        return True
    except ClientError as e:
        logger.error(f"S3 delete failed for '{s3_key}': {e}")
        return False


def check_s3_object_exists(s3_key: str, bucket: Optional[str] = None) -> bool:
    """Check if an S3 object exists without downloading it."""
    bucket = bucket or settings.S3_BUCKET_NAME
    client = get_s3_client()
    try:
        client.head_object(Bucket=bucket, Key=s3_key)
        return True
    except ClientError:
        return False


def download_s3_object(s3_key: str, bucket: Optional[str] = None) -> Optional[bytes]:
    """Download an S3 object and return its bytes."""
    bucket = bucket or settings.S3_BUCKET_NAME
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=bucket, Key=s3_key)
        return response["Body"].read()
    except ClientError as e:
        logger.error(f"S3 download failed for '{s3_key}': {e}")
        return None


def create_bucket_if_not_exists(bucket_name: str, region: str) -> bool:
    """Idempotently create an S3 bucket with best-practice defaults."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=bucket_name)
        logger.info(f"S3 bucket '{bucket_name}' already exists.")
        return True
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            pass
        else:
            logger.error(f"Error checking bucket: {e}")
            return False

    try:
        kwargs = {"Bucket": bucket_name}
        if region != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
        client.create_bucket(**kwargs)

        # Block all public access
        client.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        )

        # Enable versioning
        client.put_bucket_versioning(
            Bucket=bucket_name,
            VersioningConfiguration={"Status": "Enabled"},
        )

        # Enable server-side encryption by default
        client.put_bucket_encryption(
            Bucket=bucket_name,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            },
        )

        # Lifecycle: archive old objects after 365 days
        client.put_bucket_lifecycle_configuration(
            Bucket=bucket_name,
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "deepcare-archive",
                        "Status": "Enabled",
                        "Filter": {"Prefix": "patients/"},
                        "Transitions": [
                            {"Days": 365, "StorageClass": "STANDARD_IA"},
                            {"Days": 730, "StorageClass": "GLACIER"},
                        ],
                    }
                ]
            },
        )

        logger.info(f"S3 bucket '{bucket_name}' created with security defaults.")
        return True
    except ClientError as e:
        logger.error(f"Failed to create bucket '{bucket_name}': {e}")
        return False
