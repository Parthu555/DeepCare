# ALB Security Group
resource "aws_security_group" "alb_sg" {
  name        = "${var.environment}-deepcare-alb-sg"
  description = "Controls public inbound traffic to DeepCare ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP inbound from web"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS inbound from web"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-alb-sg"
    Environment = var.environment
  }
}

# EC2 App Instances Security Group
resource "aws_security_group" "app_sg" {
  name        = "${var.environment}-deepcare-app-sg"
  description = "Security group for DeepCare backend app instances"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB to FastAPI backend"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    description     = "Traffic from ALB to React Frontend static server"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-app-sg"
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "deepcare_alb" {
  name               = "${var.environment}-deepcare-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name        = "${var.environment}-deepcare-alb"
    Environment = var.environment
  }
}

# Target Group for Backend API
resource "aws_lb_target_group" "backend_tg" {
  name        = "${var.environment}-deepcare-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "8000"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${var.environment}-backend-tg"
    Environment = var.environment
  }
}

# ALB Listener for HTTP (Port 80)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.deepcare_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_tg.arn
  }
}

# Data source for latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Launch Template for DeepCare Backend + AI Inference Instances
resource "aws_launch_template" "app_lt" {
  name_prefix   = "${var.environment}-deepcare-lt-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = var.iam_instance_profile_name
  }

  vpc_security_group_ids = [aws_security_group.app_sg.id]

  user_data = base64encode(<<-EOF
              #!/bin/bash
              set -e
              apt-get update -y
              apt-get install -y docker.io docker-compose git awscli
              systemctl enable docker
              systemctl start docker
              usermod -aG docker ubuntu

              # Fetch application container or clone repo
              mkdir -p /opt/deepcare
              cd /opt/deepcare

              # Create environment file from AWS Secrets / parameters
              cat <<ENV > .env
              APP_ENV=${var.environment}
              DATABASE_URL=postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}/${var.db_name}
              S3_BUCKET_NAME=${var.s3_bucket_name}
              AWS_REGION=${var.aws_region}
              ML_MODEL_PATH=/opt/deepcare/ml/models/densenet121_chestxray.pt
              ENV

              echo "DeepCare EC2 instance initialized successfully"
              EOF
  )

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.environment}-deepcare-worker"
      Environment = var.environment
      Project     = "DeepCare"
    }
  }
}

# Auto Scaling Group across Private Application Subnets
resource "aws_autoscaling_group" "app_asg" {
  name                = "${var.environment}-deepcare-asg"
  vpc_zone_identifier = var.app_private_subnet_ids
  target_group_arns   = [aws_lb_target_group.backend_tg.arn]

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.app_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.environment}-deepcare-app"
    propagate_at_launch = true
  }
}
