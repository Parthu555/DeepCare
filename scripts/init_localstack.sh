#!/bin/bash
echo "Initializing DeepCare LocalStack AWS mock resources..."

# Create S3 bucket for medical images
awslocal s3 mb s3://deepcare-medical-vault-dev

# Create CloudWatch log groups
awslocal logs create-log-group --log-group-name /deepcare/dev/backend
awslocal logs create-log-group --log-group-name /deepcare/dev/ai-inference

echo "DeepCare LocalStack initialization complete."
