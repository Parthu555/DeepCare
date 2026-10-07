resource "aws_kms_key" "s3_kms" {
  description             = "KMS Key for DeepCare medical image and report encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-deepcare-s3-kms"
    Environment = var.environment
    Compliance  = "HIPAA"
  }
}

resource "aws_s3_bucket" "medical_vault" {
  bucket        = "${var.environment}-deepcare-medical-vault-${var.aws_account_id}"
  force_destroy = false

  tags = {
    Name        = "${var.environment}-deepcare-medical-vault"
    Environment = var.environment
    Compliance  = "HIPAA"
    DataClass   = "ProtectedHealthInformation"
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "public_access_block" {
  bucket = aws_s3_bucket.medical_vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# KMS Server Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "sse" {
  bucket = aws_s3_bucket.medical_vault.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_kms.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# Versioning
resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.medical_vault.id
  versioning_configuration {
    status = "Enabled"
  }
}

# CORS Configuration for Pre-signed URLs from Frontend
resource "aws_s3_bucket_cors_configuration" "cors" {
  bucket = aws_s3_bucket.medical_vault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = var.allowed_cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Lifecycle Configuration (Transition old raw DICOM/images to Glacier)
resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.medical_vault.id

  rule {
    id     = "archive-old-xrays"
    status = "Enabled"

    filter {
      prefix = "xrays/raw/"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}
