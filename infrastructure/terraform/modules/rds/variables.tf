variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "app_private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks of application private subnets allowed to access database"
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_subnet_group_name" {
  type        = string
  description = "DB subnet group name"
}

variable "instance_class" {
  type        = string
  description = "Database instance size"
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage in GB"
  default     = 20
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "deepcare_db"
}

variable "db_username" {
  type        = string
  description = "Master username"
  default     = "deepcare_admin"
}

variable "db_password" {
  type        = string
  description = "Master database password"
  sensitive   = true
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ replication"
  default     = false
}
