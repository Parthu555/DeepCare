variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "aws_account_id" {
  type        = string
  description = "AWS Account ID for globally unique bucket naming"
  default     = "123456789012"
}

variable "allowed_cors_origins" {
  type        = list(string)
  description = "Origins permitted to upload/view via pre-signed S3 URLs"
  default     = ["http://localhost:3000", "http://localhost:5173", "https://deepcare.health"]
}
