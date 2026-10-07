output "bucket_id" {
  value       = aws_s3_bucket.medical_vault.id
  description = "The name/ID of the DeepCare S3 medical vault bucket"
}

output "bucket_arn" {
  value       = aws_s3_bucket.medical_vault.arn
  description = "The ARN of the DeepCare S3 medical vault bucket"
}

output "kms_key_arn" {
  value       = aws_kms_key.s3_kms.arn
  description = "The ARN of the KMS key used to encrypt the S3 bucket"
}
