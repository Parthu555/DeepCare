"""
DeepCare FastAPI Application Entry Point.
"""
import logging
import sys
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.endpoints import auth, patients, doctors, admin
from app.services.cloudwatch_service import (
    create_cloudwatch_alarms,
    create_deepcare_dashboard,
    record_api_request,
)

# ─────────────────────────────── Logging ─────────────────────────────────────

def configure_logging():
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    if settings.CLOUDWATCH_ENABLED:
        try:
            import watchtower
            cw_handler = watchtower.CloudWatchLogHandler(
                log_group=settings.CLOUDWATCH_LOG_GROUP,
                stream_name="deepcare-backend",
                send_interval=10,
            )
            logging.getLogger().addHandler(cw_handler)
            logging.info("CloudWatch log handler attached.")
        except Exception as e:
            logging.warning(f"Could not attach CloudWatch log handler: {e}")


configure_logging()
logger = logging.getLogger("deepcare")


# ─────────────────────────────── Lifespan ────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting DeepCare API v{settings.APP_VERSION} [{settings.APP_ENV}]")
    # Initialize DB tables safely
    try:
        from app.core.database import init_db
        init_db()
        logger.info("Database tables verified/created.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    # Initialize CloudWatch monitoring if enabled
    if settings.CLOUDWATCH_ENABLED:
        create_deepcare_dashboard()
        create_cloudwatch_alarms(settings.SNS_TOPIC_ARN)

    # Seed admin user if not present
    _seed_admin()

    yield
    logger.info("DeepCare API shutting down.")


def _seed_admin():
    """Create the default admin user on first boot if none exists."""
    from app.core.database import SessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User

    db = SessionLocal()
    try:
        admin_email = settings.ADMIN_EMAIL
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            existing_admin = db.query(User).filter(User.role == "admin").first()
            if not existing_admin:
                admin_password = settings.ADMIN_PASSWORD
                user = User(
                    email=admin_email,
                    hashed_password=get_password_hash(admin_password),
                    role="admin",
                    is_active=True,
                    is_verified=True,
                )
                db.add(user)
                db.commit()
                logger.info(f"Default admin user created: {admin_email}")
            else:
                logger.info(f"Existing admin found ({existing_admin.email}); skipping admin seed.")
        else:
            logger.info(f"Admin user already present: {admin_email}; preserving credentials.")
    except Exception as e:
        db.rollback()
        logger.error(f"Admin seed failed: {e}")
    finally:
        db.close()


# ─────────────────────────────── Rate Limiting ───────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ─────────────────────────────── Application ─────────────────────────────────

app = FastAPI(
    title="DeepCare API",
    description=(
        "DeepCare: Cloud-Based Intelligent Healthcare Management and Medical Image Analysis. "
        "Powered by AWS, FastAPI, and Deep Learning."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─────────────────────────────── Request Logging ─────────────────────────────

@app.middleware("http")
async def request_logger(request: Request, call_next):
    start_time = time.monotonic()
    response: Response = await call_next(request)
    duration_ms = (time.monotonic() - start_time) * 1000

    # Log request (no PII in logs)
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} "
        f"[{duration_ms:.1f}ms]"
    )

    # Emit CloudWatch metric
    record_api_request(
        endpoint=request.url.path,
        method=request.method,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )

    # Add response headers
    response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
    response.headers["X-API-Version"] = settings.APP_VERSION
    return response


# ─────────────────────────────── Routers ─────────────────────────────────────

API_PREFIX = settings.API_V1_STR

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(patients.router, prefix=API_PREFIX)
app.include_router(doctors.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


# ─────────────────────────────── Health Checks ───────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    """Basic health check for load balancers and uptime monitors."""
    return {
        "status": "healthy",
        "service": "DeepCare API",
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@app.get("/health/detailed", tags=["Health"])
def detailed_health_check():
    """Detailed health check including DB and AI model status."""
    from app.core.database import SessionLocal
    from app.services.ai_service import get_model_status
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

    checks = {}

    # Database
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"

    # AI Model
    model_status = get_model_status()
    checks["ai_model"] = "loaded" if model_status["model_available"] else "unavailable"

    # S3 (lightweight check)
    try:
        s3 = boto3.client("s3", region_name=settings.AWS_REGION)
        s3.head_bucket(Bucket=settings.S3_BUCKET_NAME)
        checks["s3"] = "accessible"
    except (ClientError, NoCredentialsError) as e:
        checks["s3"] = f"unavailable: {type(e).__name__}"

    overall = "healthy" if all("unhealthy" not in str(v) for v in checks.values()) else "degraded"

    return {
        "status": overall,
        "checks": checks,
        "model_info": {
            "name": model_status["model_name"],
            "version": model_status["model_version"],
            "available": model_status["model_available"],
        },
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to DeepCare API",
        "docs": "/api/docs",
        "version": settings.APP_VERSION,
    }
