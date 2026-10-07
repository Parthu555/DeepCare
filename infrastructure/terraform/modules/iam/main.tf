resource "aws_iam_role" "ec2_role" {
  name = "${var.environment}-deepcare-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-deepcare-ec2-role"
    Environment = var.environment
    Compliance  = "HIPAA"
  }
}

# Policy for S3 Medical Vault Access
resource "aws_iam_policy" "s3_access_policy" {
  name        = "${var.environment}-deepcare-s3-policy"
  description = "Allows DeepCare backend to read and write scans and reports in S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# Policy for CloudWatch Logging & Metrics
resource "aws_iam_policy" "cloudwatch_policy" {
  name        = "${var.environment}-deepcare-cloudwatch-policy"
  description = "Allows DeepCare backend to send logs and custom inference metrics to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/deepcare/*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" : "DeepCare/Healthcare"
          }
        }
      }
    ]
  })
}

# Policy for SES Patient Email Notifications
resource "aws_iam_policy" "ses_policy" {
  name        = "${var.environment}-deepcare-ses-policy"
  description = "Allows DeepCare backend to send transactional diagnostic notifications via Amazon SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach policies
resource "aws_iam_role_policy_attachment" "s3_attach" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

resource "aws_iam_role_policy_attachment" "cw_attach" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.cloudwatch_policy.arn
}

resource "aws_iam_role_policy_attachment" "ses_attach" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.ses_policy.arn
}

# Attach AWS managed SSM policy for secure session manager access (no open SSH port 22 needed)
resource "aws_iam_role_policy_attachment" "ssm_attach" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# EC2 Instance Profile
resource "aws_iam_instance_profile" "instance_profile" {
  name = "${var.environment}-deepcare-instance-profile"
  role = aws_iam_role.ec2_role.name
}
