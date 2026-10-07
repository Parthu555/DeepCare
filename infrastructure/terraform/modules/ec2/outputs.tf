output "alb_dns_name" {
  value       = aws_lb.deepcare_alb.dns_name
  description = "Public DNS name of the Application Load Balancer"
}

output "alb_arn" {
  value       = aws_lb.deepcare_alb.arn
  description = "ARN of the Application Load Balancer"
}

output "app_security_group_id" {
  value       = aws_security_group.app_sg.id
  description = "Security Group ID of the EC2 App Instances"
}

output "asg_name" {
  value       = aws_autoscaling_group.app_asg.name
  description = "Name of the Auto Scaling Group"
}
