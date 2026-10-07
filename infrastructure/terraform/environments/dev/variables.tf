variable "environment" {
  type        = string
  description = "Environment identifier"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "Target AWS Region"
  default     = "us-east-1"
}

variable "aws_account_id" {
  type        = string
  description = "AWS Account ID"
  default     = "123456789012"
}

variable "availability_zones" {
  type        = list(string)
  description = "Target AWS Availability Zones"
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_password" {
  type        = string
  description = "PostgreSQL password for DeepCare application"
  sensitive   = true
  default     = "DeepCareSecurePass2026!"
}
