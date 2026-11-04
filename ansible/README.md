# DeepCare — Ansible Automation Layer

This directory provides a production-ready, modular Ansible automation framework for provisioning, configuring, and deploying the **DeepCare Cloud-Based Healthcare Management & Medical Image Analysis System** onto Kubernetes clusters.

---

## 📁 Architecture & Directory Structure

```
ansible/
├── ansible.cfg                  # Global Ansible runtime configuration & SSH settings
├── inventory/
│   ├── local.ini                # Local development inventory (KIND, Minikube, Docker Desktop)
│   └── cluster.ini              # Multi-node production cluster (1 Control Plane + 2 Workers)
├── group_vars/
│   ├── all.yml                  # Global app variables, container tags, ports, and health checks
│   └── kubernetes.yml           # Kernel modules, sysctl, CNI, and resource constraints
├── playbooks/
│   ├── setup_environment.yml    # Checks hardware, OS, Docker, and Kubectl prerequisites
│   ├── install_docker.yml       # Idempotent Docker Engine & containerd setup
│   ├── install_kubernetes.yml   # Node preparation (swap off, sysctl, bridge netfilter)
│   ├── configure_nodes.yml      # Multi-node labeling, roles, and storage classes
│   └── deploy_deepcare.yml      # Applies K8s manifests, monitors rollouts, runs smoke tests
├── roles/
│   ├── docker/                  # Tasks, handlers, and variables for container runtime
│   ├── kubernetes/              # Tasks, handlers, and variables for K8s prerequisites
│   └── deepcare/                # Manifest deployment, rollout monitoring, and health checking
└── templates/
    └── kind-cluster.yaml.j2     # Jinja2 template for 3-node KIND cluster topology
```

---

## ⚙️ Key Features & Principles

1. **Strict Application Preservation:**
   - Ansible acts strictly as an infrastructure and deployment automation layer.
   - It **does not alter** any application code in `frontend/` or `backend/`, preserving existing logic, database schemas, and ML inference pipelines.
2. **Idempotence:**
   - Every playbook can be re-run safely multiple times without causing side effects or downtime.
3. **Multi-Environment Support:**
   - `inventory/local.ini`: Targets local developers using Docker Desktop, Minikube, or KIND on Windows/Mac/Linux.
   - `inventory/cluster.ini`: Targets 3-node Linux VM clusters (1 master + 2 workers).
4. **Security & Zero Plaintext Secrets:**
   - Sensitive database passwords and JWT secrets are managed via Kubernetes Secret templates rather than hardcoded in Ansible playbooks.

---

## 🚀 Execution Instructions

### Option 1: Running via Docker (No Local Ansible Installation Required)

If running on Windows without Ansible installed natively, use Docker to run the playbooks immediately:

```bash
# From the project root:
docker run --rm -it \
  -v ${PWD}:/workspace \
  -w /workspace/ansible \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --network host \
  williamyeh/ansible:alpine3 \
  ansible-playbook -i inventory/local.ini playbooks/setup_environment.yml
```

### Option 2: Running via WSL or Linux Terminal

Ensure Ansible is installed:
```bash
pip install ansible
```

#### Step 1: Environment Readiness Check
```bash
ansible-playbook -i inventory/local.ini playbooks/setup_environment.yml
```

#### Step 2: Container Runtime Setup
```bash
ansible-playbook -i inventory/local.ini playbooks/install_docker.yml
```

#### Step 3: Kubernetes Prerequisites & Node Preparation
```bash
ansible-playbook -i inventory/local.ini playbooks/install_kubernetes.yml
```

#### Step 4: Cluster Topology & Node Configuration
```bash
ansible-playbook -i inventory/local.ini playbooks/configure_nodes.yml
```

#### Step 5: End-to-End DeepCare Deployment & Smoke Testing
```bash
ansible-playbook -i inventory/local.ini playbooks/deploy_deepcare.yml
```

---

## 🔍 Playbook Breakdown & Verification

| Playbook | Purpose | Verification Command |
|---|---|---|
| `setup_environment.yml` | Audits RAM, OS, Docker CLI, and Kubectl client | Check Ansible summary: 0 failures |
| `install_docker.yml` | Ensures Docker daemon and containerd are active | `docker info` |
| `install_kubernetes.yml` | Verifies kernel bridge, swap status, and CNI readiness | `kubectl cluster-info` |
| `configure_nodes.yml` | Applies `deepcare.health/tier=app` labels to nodes | `kubectl get nodes --show-labels` |
| `deploy_deepcare.yml` | Deploys K8s workloads, awaits rollouts, verifies `/health/live` | `kubectl get pods -n deepcare` |

---

## 🌐 Deployed Service Endpoints

Once `deploy_deepcare.yml` finishes, the following services are available:
- **Web Portal:** [http://localhost:30080](http://localhost:30080)
- **FastAPI OpenAPI Docs:** [http://localhost:30080/docs](http://localhost:30080/docs)
- **Liveness Probe:** [http://localhost:30080/health/live](http://localhost:30080/health/live)
- **Readiness Probe:** [http://localhost:30080/health/ready](http://localhost:30080/health/ready)
- **Prometheus Metrics:** [http://localhost:30090](http://localhost:30090)
- **Grafana Dashboards:** [http://localhost:30030](http://localhost:30030)

