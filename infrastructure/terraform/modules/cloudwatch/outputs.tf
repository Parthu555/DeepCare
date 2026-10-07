output "backend_log_group_arn" {
  value       = aws_cloudwatch_log_group.backend_logs.arn
  description = "ARN of the backend CloudWatch log group"
}

output "ai_log_group_arn" {
  value       = aws_cloudwatch_log_group.ai_logs.arn
  description = "ARN of the AI model inference CloudWatch log group"
}
