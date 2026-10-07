# CloudWatch Log Group for Backend API
resource "aws_cloudwatch_log_group" "backend_logs" {
  name              = "/deepcare/${var.environment}/backend"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "FastAPI-Backend"
    Compliance  = "HIPAA"
  }
}

# CloudWatch Log Group for AI Inference Telemetry
resource "aws_cloudwatch_log_group" "ai_logs" {
  name              = "/deepcare/${var.environment}/ai-inference"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "DenseNet121-Model"
    Compliance  = "HIPAA"
  }
}

# Metric Alarm: High Inference Latency (> 800ms)
resource "aws_cloudwatch_metric_alarm" "high_inference_latency" {
  alarm_name          = "${var.environment}-high-inference-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "InferenceDurationMs"
  namespace           = "DeepCare/Healthcare"
  period              = 60
  statistic           = "Average"
  threshold           = 800
  alarm_description   = "Triggered when AI model inference exceeds acceptable clinical threshold of 800ms"

  tags = {
    Environment = var.environment
    Severity    = "Warning"
  }
}

# Metric Alarm: API 5XX Error Spike
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.environment}-api-5xx-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggers if more than 5 5XX server errors occur within a 1-minute window"

  tags = {
    Environment = var.environment
    Severity    = "Critical"
  }
}

# Clinical Operations & Telemetry CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "deepcare_dashboard" {
  dashboard_name = "${var.environment}-deepcare-clinical-telemetry"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["DeepCare/Healthcare", "InferenceDurationMs", { "stat" : "Average" }],
            ["...", { "stat" : "p95" }],
            ["...", { "stat" : "p99" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "AI Model Latency Distribution (ms)"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["DeepCare/Healthcare", "InferenceCount", { "stat" : "Sum" }],
            ["DeepCare/Healthcare", "XrayUploadCount", { "stat" : "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Clinical Throughput (Uploads vs Inferences)"
        }
      }
    ]
  })
}
