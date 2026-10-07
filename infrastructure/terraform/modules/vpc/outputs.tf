output "vpc_id" {
  value       = aws_vpc.deepcare_vpc.id
  description = "The ID of the VPC"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "IDs of the public subnets"
}

output "app_private_subnet_ids" {
  value       = aws_subnet.app_private[*].id
  description = "IDs of the application private subnets"
}

output "db_subnet_group_name" {
  value       = aws_db_subnet_group.deepcare_db_subnet_group.name
  description = "The name of the database subnet group"
}

output "app_private_subnet_cidrs" {
  value       = var.app_private_subnet_cidrs
  description = "CIDR blocks of application private subnets"
}
