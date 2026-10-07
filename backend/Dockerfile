FROM python:3.11-slim

LABEL maintainer="DeepCare Team"
LABEL description="DeepCare FastAPI Backend"

# Security: run as non-root
RUN groupadd -r deepcare && useradd -r -g deepcare deepcare

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (as root for pip)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/ml/models /tmp/reports \
    && chown -R deepcare:deepcare /app /tmp/reports

# Switch to non-root
USER deepcare

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
