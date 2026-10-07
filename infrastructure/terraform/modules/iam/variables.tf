variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "s3_bucket_arn" {
  type        = string
  description = "The ARN of the DeepCare S3 medical vault bucket"
}

variable "kms_key_arn" {
  type        = string
  description = "The ARN of the KMS key used for S3 encryption"
}
