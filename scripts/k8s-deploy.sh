#!/usr/bin/env bash
set -e

NAMESPACE="deepcare"
echo "=========================================================="
echo " 🚀 DeepCare Healthcare — Cloud-Native Kubernetes Deploy"
echo "=========================================================="

echo "[1/4] Checking Kubernetes connectivity..."
kubectl get nodes

echo "[2/4] Applying manifests to namespace ${NAMESPACE}..."
kubectl apply -k infrastructure/k8s/

echo "[3/4] Waiting for deployments to stabilize..."
kubectl rollout restart deployment/deepcare-backend -n ${NAMESPACE} || true
kubectl rollout restart deployment/deepcare-frontend -n ${NAMESPACE} || true

kubectl rollout status deployment/deepcare-postgres -n ${NAMESPACE} --timeout=120s || true
kubectl rollout status deployment/deepcare-backend -n ${NAMESPACE} --timeout=180s || true
kubectl rollout status deployment/deepcare-frontend -n ${NAMESPACE} --timeout=180s || true
kubectl rollout status deployment/deepcare-prometheus -n ${NAMESPACE} --timeout=120s || true
kubectl rollout status deployment/deepcare-grafana -n ${NAMESPACE} --timeout=120s || true

echo "[4/4] DeepCare Cluster Resources:"
kubectl get pods,svc -n ${NAMESPACE}

echo "=========================================================="
echo " 🎉 Deployment Complete!"
echo "  • Frontend:    http://localhost:30080"
echo "  • Prometheus:  http://localhost:30090"
echo "  • Grafana:     http://localhost:30030 (admin/admin)"
echo "=========================================================="

