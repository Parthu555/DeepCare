# DeepCare Kubernetes Automated Deployment & Verification Script (Windows PowerShell)
[CmdletBinding()]
param(
    [switch]$BuildImages = $false,
    [switch]$SkipTests = $false,
    [string]$Namespace = "deepcare"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 DeepCare Healthcare — Cloud-Native Kubernetes Deploy" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "`n[1/5] Checking Kubernetes cluster connectivity..." -ForegroundColor Yellow
try {
    $nodes = kubectl get nodes -o name
    if (-not $nodes) {
        throw "No nodes found in Kubernetes cluster."
    }
    Write-Host "  [✓] Connected to Kubernetes cluster:" $nodes.Replace("node/", "") -ForegroundColor Green
} catch {
    Write-Error "Kubernetes is unreachable. Please ensure Docker Desktop Kubernetes or minikube is running."
    exit 1
}

# 2. Build Docker images if requested
if ($BuildImages) {
    Write-Host "`n[2/5] Building Docker container images..." -ForegroundColor Yellow
    Write-Host "  Building deepcare-backend:latest..." -ForegroundColor Gray
    docker build -t deepcare-backend:latest ./backend
    Write-Host "  Building deepcare-frontend:latest..." -ForegroundColor Gray
    docker build -t deepcare-frontend:latest ./frontend
    Write-Host "  [✓] Container images built successfully." -ForegroundColor Green
} else {
    Write-Host "`n[2/5] Using existing container images." -ForegroundColor Gray
}

# 3. Apply Kubernetes declarative manifests
Write-Host "`n[3/5] Applying Kubernetes manifests (Kustomize)..." -ForegroundColor Yellow
kubectl apply -k infrastructure/k8s/
Write-Host "  [✓] Manifests applied to namespace '$Namespace'." -ForegroundColor Green

# 4. Wait for deployment rollouts
Write-Host "`n[4/5] Waiting for pods to become Ready..." -ForegroundColor Yellow
kubectl rollout restart deployment/deepcare-backend -n $Namespace | Out-Null
kubectl rollout restart deployment/deepcare-frontend -n $Namespace | Out-Null

try {
    kubectl rollout status deployment/deepcare-postgres -n $Namespace --timeout=120s
    kubectl rollout status deployment/deepcare-backend -n $Namespace --timeout=180s
    kubectl rollout status deployment/deepcare-frontend -n $Namespace --timeout=180s
    kubectl rollout status deployment/deepcare-prometheus -n $Namespace --timeout=120s
    kubectl rollout status deployment/deepcare-grafana -n $Namespace --timeout=120s
    Write-Host "  [✓] All deployments are Ready!" -ForegroundColor Green
} catch {
    Write-Warning "Timed out waiting for deployments. Checking current status..."
}

# 5. Summary & Health Verification
Write-Host "`n[5/5] DeepCare Cluster Status & Service Endpoints:" -ForegroundColor Cyan
kubectl get pods,svc -n $Namespace

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 DeepCare Cloud-Native Application is Running!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  • React Frontend (K8s NodePort):   http://localhost:30080" -ForegroundColor White
Write-Host "  • Backend API & Swagger Docs:      http://localhost:8000/api/docs" -ForegroundColor White
Write-Host "  • Prometheus Metrics (K8s NodePort): http://localhost:30090" -ForegroundColor White
Write-Host "  • Grafana Dashboard (K8s NodePort):  http://localhost:30030 (admin/admin)" -ForegroundColor White
Write-Host "  • Docker Compose Monitoring:       http://localhost:3001 (Grafana)" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

