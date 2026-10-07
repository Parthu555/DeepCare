variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS Region"
  default     = "us-east-1"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs for ALB"
}

variable "app_private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for EC2 Auto Scaling Group"
}

variable "iam_instance_profile_name" {
  type        = string
  description = "IAM instance profile name"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance size for FastAPI + PyTorch DenseNet"
  default     = "t3.xlarge"
}

variable "asg_min_size" {
  type        = number
  description = "Minimum number of EC2 instances"
  default     = 1
}

variable "asg_max_size" {
  type        = number
  description = "Maximum number of EC2 instances"
  default     = 4
}

variable "asg_desired_capacity" {
  type        = number
  description = "Desired number of EC2 instances"
  default     = 2
}

variable "s3_bucket_name" {
  type        = string
  description = "DeepCare S3 bucket name"
}

variable "db_endpoint" {
  type        = string
  description = "PostgreSQL endpoint"
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "deepcare_db"
}

variable "db_username" {
  type        = string
  description = "Database user"
  default     = "deepcare_admin"
}

variable "db_password" {
  type        = string
  description = "Database password"
  sensitive   = true
}
