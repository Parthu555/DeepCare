resource "aws_security_group" "rds_sg" {
  name        = "${var.environment}-deepcare-rds-sg"
  description = "Controls database traffic to DeepCare PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from App Private Subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.app_private_subnet_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-rds-sg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.environment}-deepcare-pg"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = var.environment == "dev" ? true : false

  backup_retention_period = var.environment == "dev" ? 1 : 14
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"

  auto_minor_version_upgrade = true
  deletion_protection        = var.environment == "prod" ? true : false

  tags = {
    Name        = "${var.environment}-deepcare-postgres"
    Environment = var.environment
    Compliance  = "HIPAA"
  }
}
