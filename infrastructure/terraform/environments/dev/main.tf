terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "DeepCare"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA"
    }
  }
}

# 1. VPC Module
module "vpc" {
  source             = "../../modules/vpc"
  environment        = var.environment
  availability_zones = var.availability_zones
}

# 2. S3 Medical Vault Module
module "s3" {
  source         = "../../modules/s3"
  environment    = var.environment
  aws_account_id = var.aws_account_id
}

# 3. IAM Module
module "iam" {
  source        = "../../modules/iam"
  environment   = var.environment
  s3_bucket_arn = module.s3.bucket_arn
  kms_key_arn   = module.s3.kms_key_arn
}

# 4. CloudWatch Telemetry Module
module "cloudwatch" {
  source      = "../../modules/cloudwatch"
  environment = var.environment
  aws_region  = var.aws_region
}

# 5. RDS PostgreSQL Module
module "rds" {
  source                   = "../../modules/rds"
  environment              = var.environment
  vpc_id                   = module.vpc.vpc_id
  db_subnet_group_name     = module.vpc.db_subnet_group_name
  app_private_subnet_cidrs = module.vpc.app_private_subnet_cidrs
  db_password              = var.db_password
}

# 6. EC2 Auto Scaling & ALB Module
module "ec2" {
  source                    = "../../modules/ec2"
  environment               = var.environment
  aws_region                = var.aws_region
  vpc_id                    = module.vpc.vpc_id
  public_subnet_ids         = module.vpc.public_subnet_ids
  app_private_subnet_ids    = module.vpc.app_private_subnet_ids
  iam_instance_profile_name = module.iam.instance_profile_name
  s3_bucket_name            = module.s3.bucket_id
  db_endpoint               = module.rds.db_endpoint
  db_password               = var.db_password
}
