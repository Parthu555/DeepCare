variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "log_retention_days" {
  type        = number
  description = "Log retention period in days for HIPAA compliance"
  default     = 365
}
