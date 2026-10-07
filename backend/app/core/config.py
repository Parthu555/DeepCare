"""
DeepCare Application Configuration
Loads from environment variables and AWS Secrets Manager.
"""
import json
import os
import logging
from functools import lru_cache
from typing import List, Optional

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from pydantic import field_validator, AnyHttpUrl
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


def get_secret_from_aws(secret_name: str, region: str = "ap-south-1") -> dict:
    """Fetch a secret from AWS Secrets Manager."""
    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response["SecretString"])
    except (ClientError, NoCredentialsError) as e:
        logger.warning(f"Could not fetch secret '{secret_name}' from AWS: {e}")
        return {}


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "DeepCare"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_SECRETS_MANAGER"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Default Admin Credentials
    ADMIN_EMAIL: str = "admin@deepcare.health"
    ADMIN_PASSWORD: str = "AdminPass123!"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Database
    DATABASE_URL: str = "postgresql://deepcare_user:deepcare_pass@localhost:5432/deepcare_db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # AWS Core
    AWS_REGION: str = "ap-south-1"
    AWS_ACCOUNT_ID: Optional[str] = None

    # AWS S3
    S3_BUCKET_NAME: str = "deepcare-medical-storage"
    S3_PRESIGNED_URL_EXPIRY: int = 900  # 15 minutes
    S3_MAX_FILE_SIZE_MB: int = 50
    S3_ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/dicom"]
    S3_ALLOWED_DOC_TYPES: List[str] = ["application/pdf"]

    # AWS Secrets Manager
    USE_AWS_SECRETS_MANAGER: bool = False
    AWS_SECRET_NAME_DB: str = "deepcare/database"
    AWS_SECRET_NAME_APP: str = "deepcare/application"

    # CloudWatch
    CLOUDWATCH_LOG_GROUP: str = "/deepcare/application"
    CLOUDWATCH_ENABLED: bool = False
    CLOUDWATCH_METRICS_NAMESPACE: str = "DeepCare/Application"

    # AI/ML
    ML_MODEL_PATH: str = "/app/ml/models/densenet121_xray.pth"
    ML_MODEL_NAME: str = "DenseNet121-ChestXray"
    ML_MODEL_VERSION: str = "1.0.0"
    ML_CONFIDENCE_THRESHOLD: float = 0.5
    ML_INFERENCE_TIMEOUT: int = 30
    ML_DEVICE: str = "cpu"
    S3_MODEL_KEY: Optional[str] = None  # e.g. "models/densenet121_xray.pth"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # PDF
    PDF_STORAGE_PATH: str = "/tmp/reports"

    # Patient ID
    PATIENT_ID_PREFIX: str = "DC"
    PATIENT_ID_LENGTH: int = 8

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Email (SNS notifications)
    SNS_TOPIC_ARN: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    def load_aws_secrets(self) -> None:
        """Optionally override settings from AWS Secrets Manager."""
        if not self.USE_AWS_SECRETS_MANAGER:
            return
        db_secrets = get_secret_from_aws(self.AWS_SECRET_NAME_DB, self.AWS_REGION)
        if db_secrets:
            host = db_secrets.get("host", "")
            port = db_secrets.get("port", 5432)
            dbname = db_secrets.get("dbname", "deepcare_db")
            username = db_secrets.get("username", "")
            password = db_secrets.get("password", "")
            if all([host, username, password]):
                self.DATABASE_URL = (
                    f"postgresql://{username}:{password}@{host}:{port}/{dbname}"
                )
                logger.info("Database URL loaded from AWS Secrets Manager.")
        app_secrets = get_secret_from_aws(self.AWS_SECRET_NAME_APP, self.AWS_REGION)
        if app_secrets:
            if "SECRET_KEY" in app_secrets:
                self.SECRET_KEY = app_secrets["SECRET_KEY"]
            logger.info("App secrets loaded from AWS Secrets Manager.")


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.load_aws_secrets()
    return settings


settings = get_settings()
