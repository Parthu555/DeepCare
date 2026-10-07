import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { adminAPI } from '../../services/api';
import {
  Users, Stethoscope, Image, FileText, Activity,
  CheckCircle, Clock, BarChart3, TrendingUp, Shield,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getStats(),
      adminAPI.listDoctors(1, false),
    ]).then(([statsRes, doctorRes]) => {
      setStats(statsRes.data);
      setPendingDoctors(doctorRes.data?.items?.slice(0, 5) || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleApprove = async (doctor_id: string) => {
    await adminAPI.approveDoctor(doctor_id, true);
    setPendingDoctors((prev) => prev.filter((d) => d.doctor_id !== doctor_id));
    setStats((prev: any) => ({
      ...prev,
      approved_doctors: prev.approved_doctors + 1,
      pending_doctors: prev.pending_doctors - 1,
    }));
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const overviewData = [
    { name: 'Patients', value: stats?.total_patients || 0, icon: <Users className="w-6 h-6 text-blue-500" />, color: 'bg-blue-50' },
    { name: 'Doctors', value: stats?.total_doctors || 0, icon: <Stethoscope className="w-6 h-6 text-teal-500" />, color: 'bg-teal-50' },
    { name: 'X-Rays', value: stats?.total_xrays || 0, icon: <Image className="w-6 h-6 text-purple-500" />, color: 'bg-purple-50' },
    { name: 'Reports', value: stats?.total_reports || 0, icon: <FileText className="w-6 h-6 text-emerald-500" />, color: 'bg-emerald-50' },
    { name: 'AI Analyses', value: stats?.total_analyses || 0, icon: <Activity className="w-6 h-6 text-amber-500" />, color: 'bg-amber-50' },
    { name: 'Consultations', value: stats?.total_consultations || 0, icon: <CheckCircle className="w-6 h-6 text-rose-500" />, color: 'bg-rose-50' },
  ];

  const pieData = [
    { name: 'Approved Doctors', value: stats?.approved_doctors || 0 },
    { name: 'Pending Doctors', value: stats?.pending_doctors || 0 },
    { name: 'Patients', value: stats?.total_patients || 0 },
  ];

  const barData = [
    { name: 'Reports', total: stats?.total_reports || 0, approved: stats?.approved_reports || 0 },
    { name: 'X-Rays', total: stats?.total_xrays || 0, analyzed: stats?.total_analyses || 0 },
    { name: 'Consults', total: stats?.total_consultations || 0, completed: stats?.total_consultations || 0 },
  ];

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Header Banner */}
      <div className="deepcare-gradient rounded-2xl p-6 mb-6 text-white">
        <h2 className="text-2xl font-bold mb-1">System Overview</h2>
        <p className="text-teal-100 text-sm">DeepCare Administration Console</p>
        {(stats?.pending_doctors || 0) > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-500/30 rounded-lg px-3 py-2 text-sm w-fit">
            <AlertTriangle className="w-4 h-4" />
            {stats.pending_doctors} doctor(s) pending approval
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {overviewData.map((item) => (
          <div key={item.name} className="stat-card">
            <div className={`p-3 rounded-xl ${item.color} w-fit mb-3`}>{item.icon}</div>
            <p className="text-3xl font-bold text-slate-800">{item.value}</p>
            <p className="text-sm text-slate-500">{item.name}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            Activity Overview
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip />
              <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} name="Total" />
              <Bar dataKey="approved" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Approved/Analyzed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-teal-600" />
            User Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending Doctor Approvals */}
      {pendingDoctors.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm mb-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Doctor Approvals
          </h3>
          <div className="space-y-3">
            {pendingDoctors.map((doc) => (
              <div key={doc.doctor_id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <p className="font-medium text-slate-800">{doc.name}</p>
                  <p className="text-sm text-slate-500">{doc.specialization} · {doc.doctor_id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(doc.doctor_id)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition">
                    Approve
                  </button>
                  <button onClick={async () => {
                    await adminAPI.approveDoctor(doc.doctor_id, false);
                    setPendingDoctors((prev) => prev.filter((d) => d.doctor_id !== doc.doctor_id));
                  }}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium rounded-lg transition">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Audit Activity */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-teal-600" />
          Recent Audit Activity
        </h3>
        {(stats?.recent_activity || []).length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No audit events yet</p>
        ) : (
          <div className="space-y-2">
            {(stats?.recent_activity || []).map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <code className="text-xs text-slate-600 font-mono">{log.action}</code>
                <span className="ml-auto text-xs text-slate-400">
                  {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
