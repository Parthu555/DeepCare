variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  default     = "dev"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for DeepCare VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AWS Availability Zones"
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "app_private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for backend app private subnets"
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for database private subnets"
  default     = ["10.0.21.0/24", "10.0.22.0/24"]
}
