output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "Connection endpoint for DeepCare PostgreSQL instance"
}

output "db_address" {
  value       = aws_db_instance.postgres.address
  description = "Hostname of the database"
}

output "db_port" {
  value       = aws_db_instance.postgres.port
  description = "Port number of the database"
}
