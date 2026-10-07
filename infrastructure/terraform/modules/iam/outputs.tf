output "instance_profile_name" {
  value       = aws_iam_instance_profile.instance_profile.name
  description = "Name of the IAM instance profile for DeepCare EC2"
}

output "instance_profile_arn" {
  value       = aws_iam_instance_profile.instance_profile.arn
  description = "ARN of the IAM instance profile for DeepCare EC2"
}

output "role_arn" {
  value       = aws_iam_role.ec2_role.arn
  description = "ARN of the EC2 IAM role"
}
