output "application_load_balancer_dns" {
  value       = module.ec2.alb_dns_name
  description = "Public ALB DNS for accessing DeepCare UI & API"
}

output "s3_medical_vault_bucket" {
  value       = module.s3.bucket_id
  description = "Encrypted S3 bucket for DICOM and X-ray storage"
}

output "rds_postgres_endpoint" {
  value       = module.rds.db_endpoint
  description = "Amazon RDS PostgreSQL connection endpoint"
}

output "cloudwatch_backend_log_group" {
  value       = module.cloudwatch.backend_log_group_arn
  description = "CloudWatch log stream for backend monitoring"
}
