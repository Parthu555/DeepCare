import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { adminAPI } from '../../services/api';
import {
  Shield, Clock, User, Filter, AlertTriangle,
  Lock, Activity, Download, RefreshCw
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  status: string;
  details?: Record<string, any>;
  created_at: string;
}

const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    loadLogs();
  }, [selectedAction]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getAuditLogs(1, selectedAction || undefined);
      setLogs(res.data.items || res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN') || action.includes('AUTH')) {
      return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">{action}</span>;
    }
    if (action.includes('AI') || action.includes('INFERENCE') || action.includes('XRAY')) {
      return <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono text-[10px]">{action}</span>;
    }
    if (action.includes('DELETE') || action.includes('SUSPEND') || action.includes('FAILED')) {
      return <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono text-[10px]">{action}</span>;
    }
    return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px]">{action}</span>;
  };

  return (
    <DashboardLayout title="Security & HIPAA Compliance Audit Trail">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Immutable Access & Event Logging
            </h2>
            <p className="text-slate-300 text-xs mt-1 max-w-xl">
              Complies with HIPAA Security Rule 45 CFR § 164.312(b). Logs every medical record access, authentication attempt, inference invocation, and diagnosis certification.
            </p>
          </div>
          <button
            onClick={() => loadLogs()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Trail
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Filter Event:</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none text-slate-700 focus:border-teal-500"
            >
              <option value="">All Security Events</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="XRAY_UPLOAD">XRAY_UPLOAD</option>
              <option value="AI_INFERENCE">AI_INFERENCE</option>
              <option value="REPORT_CREATED">REPORT_CREATED</option>
            </select>
          </div>
          <span className="text-xs text-slate-400">Total Entries: <strong>{logs.length}</strong></span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 animate-pulse h-14" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Audit Events Logged</h3>
            <p className="text-xs text-slate-500 mt-1">Audit events will automatically appear here as users interact with the system.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Timestamp (UTC)</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">User / Actor ID</th>
                    <th className="p-3.5">Resource Target</th>
                    <th className="p-3.5">IP Address</th>
                    <th className="p-3.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3.5">{getActionBadge(log.action)}</td>
                      <td className="p-3.5 font-mono text-slate-800">{log.user_id || 'SYSTEM'}</td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {log.resource_type} {log.resource_id ? `(${log.resource_id})` : ''}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAuditLogs;
