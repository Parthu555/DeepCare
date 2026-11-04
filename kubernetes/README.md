# DeepCare — Multi-Node Kubernetes Deployment Infrastructure

This directory provides the production-grade, multi-node Kubernetes architecture for the **DeepCare Cloud-Based Healthcare Management & Medical Image Analysis System**.

---

## 🏗️ Multi-Node Cluster Architecture

The deployment topology is modeled for resilience, security, and workload isolation across **3 nodes**:
- **Control-Plane Master (`control-plane`):** Manages API server, scheduler, and controller manager, with port mappings for host access.
- **Worker Node 1 (`worker-1`):** Dedicated to stateless compute and AI inference (`deepcare-frontend` and `deepcare-backend` with DenseNet-121).
- **Worker Node 2 (`worker-2`):** Dedicated to stateful persistence (`deepcare-postgres` and `deepcare-localstack` with PersistentVolumeClaims).

```
                      ┌────────────────────────────────────────┐
                      │    Control Plane (Master Node)         │
                      │  API Server / Scheduler / Ingress      │
                      │  Port Mappings: 30080, 30090, 30030    │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
   ┌─────────────▼──────────────┐                ┌───────────────▼──────────────┐
   │       Worker Node 1        │                │       Worker Node 2          │
   │  Workload: backend-ai      │                │  Workload: database-storage  │
   │                            │                │                              │
   │  ┌──────────────────────┐  │                │  ┌────────────────────────┐  │
   │  │ deepcare-frontend    │  │                │  │ deepcare-postgres      │  │
   │  │ (2 Replicas)         │  │                │  │ (Stateful Pod :5432)   │  │
   │  └──────────────────────┘  │                │  └───────────┬────────────┘  │
   │  ┌──────────────────────┐  │                │              │               │
   │  │ deepcare-backend     │  │                │  ┌───────────▼────────────┐  │
   │  │ (2 Replicas + AI)    │  │                │  │ postgres-pvc (10Gi)    │  │
   │  └──────────────────────┘  │                │  └────────────────────────┘  │
   │  ┌──────────────────────┐  │                │  ┌────────────────────────┐  │
   │  │ deepcare-prometheus  │  │                │  │ deepcare-localstack    │  │
   │  │ deepcare-grafana     │  │                │  │ (Medical Vault :4566)  │  │
   │  └──────────────────────┘  │                │  └────────────────────────┘  │
   └────────────────────────────┘                └──────────────────────────────┘
```

---

## 📁 Directory Structure

```
kubernetes/
├── base/
│   ├── namespace.yaml               # Dedicated 'deepcare' namespace
│   ├── configmap.yaml               # Non-sensitive app & database parameters
│   ├── secrets-template.yaml        # Isolated credentials (DB password, JWT secret)
│   ├── postgres-deployment.yaml     # PostgreSQL 15 Deployment (Recreate strategy)
│   ├── postgres-service.yaml        # Internal ClusterIP (never exposed publicly)
│   ├── localstack-deployment.yaml   # S3 Medical Vault Storage Deployment
│   ├── localstack-service.yaml      # Internal S3 ClusterIP (:4566)
│   ├── backend-deployment.yaml      # 2-Replica FastAPI + DenseNet-121 Deployment
│   ├── backend-service.yaml         # Backend ClusterIP (:8000)
│   ├── frontend-deployment.yaml     # 2-Replica React UI Deployment
│   ├── frontend-service.yaml        # NodePort Service (:30080)
│   └── kustomization.yaml           # Base Kustomize bundle
├── overlays/
│   ├── local/
│   │   ├── kind-cluster.yaml        # 3-Node KIND configuration (1 Master + 2 Workers)
│   │   ├── service-nodeport-patch.yaml
│   │   └── kustomization.yaml       # Local development overlay
│   └── production/
│       ├── ingress.yaml             # Nginx Ingress routing for domain deployment
│       └── kustomization.yaml       # Production overlay
├── monitoring/
│   ├── prometheus.yaml              # Scraper deployment & ConfigMap (:30090)
│   ├── grafana.yaml                 # Dashboards & Datasource deployment (:30030)
│   └── kustomization.yaml
└── storage/
    ├── persistent-volumes.yaml      # PVCs for Postgres (10Gi) and LocalStack (10Gi)
    └── storageclass.yaml            # StorageClass configuration
```

---

## 🚀 Quickstart & Cluster Creation

### Step 1: Create the Multi-Node Cluster

#### Option A: Using KIND (Recommended for Multi-Node)
```bash
# Create the 3-node cluster
kind create cluster --config kubernetes/overlays/local/kind-cluster.yaml

# Verify nodes
kubectl get nodes
```

#### Option B: Using Minikube (Multi-Node)
```bash
minikube start --nodes 3 -p deepcare-cluster
```

#### Option C: Using Docker Desktop Kubernetes (Single-Node Active)
You can directly deploy to your existing Docker Desktop cluster without creating a new cluster.

---

### Step 2: Load Docker Images (if using KIND or Minikube)
Ensure the local DeepCare images are available inside the cluster:
```bash
# For KIND:
kind load docker-image deepcare-backend:latest --name deepcare-cluster
kind load docker-image deepcare-frontend:latest --name deepcare-cluster

# For Minikube:
minikube image load deepcare-backend:latest -p deepcare-cluster
minikube image load deepcare-frontend:latest -p deepcare-cluster
```

---

### Step 3: Deploy DeepCare via Kustomize

Deploy the entire cloud-native stack with one command:
```bash
kubectl apply -k kubernetes/base/
```

Or deploy with local NodePort overlays:
```bash
kubectl apply -k kubernetes/overlays/local/
```

---

### Step 4: Verify Deployment Health

```bash
# Check all pods in the deepcare namespace
kubectl get pods -n deepcare -o wide

# Check services and NodePorts
kubectl get svc -n deepcare

# Check persistent volume claims
kubectl get pvc -n deepcare
```

---

## 🌐 Application Access Endpoints

| Component | NodePort URL | Port-Forward Fallback | Function |
|---|---|---|---|
| **DeepCare Web Portal** | [http://localhost:30080](http://localhost:30080) | `kubectl port-forward svc/deepcare-frontend 3000:80 -n deepcare` | Doctor, Patient & Admin Portals |
| **FastAPI Swagger Docs**| [http://localhost:30080/docs](http://localhost:30080/docs) | `kubectl port-forward svc/deepcare-backend 8000:8000 -n deepcare` | OpenAPI Specification |
| **Liveness Probe** | [http://localhost:30080/health/live](http://localhost:30080/health/live) | — | Process Liveness Status |
| **Readiness Probe** | [http://localhost:30080/health/ready](http://localhost:30080/health/ready) | — | Database Connectivity Status |
| **Prometheus Telemetry**| [http://localhost:30090](http://localhost:30090) | `kubectl port-forward svc/deepcare-prometheus 9090:9090 -n deepcare` | `/metrics` Scraper |
| **Grafana Dashboards** | [http://localhost:30030](http://localhost:30030) | `kubectl port-forward svc/deepcare-grafana 3001:3000 -n deepcare` | Clinical Operations Dashboards |

---

## 🔧 Operational Management

### Scaling Workloads
Scale the AI inference backend pods dynamically under heavy radiological study loads:
```bash
kubectl scale deployment deepcare-backend --replicas=5 -n deepcare
```

Scale the web frontend pods:
```bash
kubectl scale deployment deepcare-frontend --replicas=4 -n deepcare
```

### Performing Zero-Downtime Rolling Updates
```bash
# Trigger rolling update
kubectl rollout restart deployment/deepcare-backend -n deepcare

# Monitor rollout progression
kubectl rollout status deployment/deepcare-backend -n deepcare

# View rollout history
kubectl rollout history deployment/deepcare-backend -n deepcare

# Rollback if needed
kubectl rollout undo deployment/deepcare-backend -n deepcare
```

### Teardown & Cleanup
```bash
# Delete all resources in the namespace
kubectl delete -k kubernetes/base/

# If using KIND, delete the cluster:
kind delete cluster --name deepcare-cluster
```

