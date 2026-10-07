import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { adminAPI } from '../../services/api';
import {
  Stethoscope, CheckCircle2, XCircle, Clock, ShieldCheck,
  FileCheck, AlertTriangle, Search
} from 'lucide-react';

interface DoctorApprovalItem {
  id: string;
  doctor_id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  license_number: string;
  years_experience?: number;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

const AdminDoctorApproval: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listDoctors(1);
      setDoctors(res.data.items || res.data || []);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (doctorId: string, approve: boolean) => {
    try {
      setActionLoading(doctorId);
      await adminAPI.approveDoctor(doctorId, approve);
      await loadDoctors();
    } catch (err) {
      console.error('Failed to approve doctor:', err);
      alert('Error changing doctor approval status.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout title="Physician Credential Verification">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Medical License Verification Queue
            </h2>
            <p className="text-slate-300 text-xs mt-1 max-w-xl">
              Strict HIPAA compliance requirement: Only verified physicians with valid medical practice credentials may inspect radiograph scans or issue electronic diagnosis.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold border border-white/10">
            Registered Doctors: <span className="font-bold text-white text-sm">{doctors.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse h-20" />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto shadow-sm">
            <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Physicians Pending Review</h3>
            <p className="text-xs text-slate-500 mt-1">All registered doctors have been evaluated or verified.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4">Physician Name</th>
                    <th className="p-4">Specialization</th>
                    <th className="p-4">Medical License #</th>
                    <th className="p-4">Experience</th>
                    <th className="p-4">Current Status</th>
                    <th className="p-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {doctors.map((doc) => (
                    <tr key={doc.id || doc.doctor_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                          {doc.first_name?.[0]}{doc.last_name?.[0]}
                        </div>
                        <div>
                          <span>Dr. {doc.first_name} {doc.last_name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{doc.doctor_id}</span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{doc.specialization}</td>
                      <td className="p-4 font-mono text-slate-600 bg-slate-50/50 rounded">{doc.license_number || 'PENDING'}</td>
                      <td className="p-4">{doc.years_experience ? `${doc.years_experience} yrs` : 'N/A'}</td>
                      <td className="p-4">
                        {doc.is_approved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" /> Under Review
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!doc.is_approved ? (
                            <button
                              onClick={() => handleApproval(doc.doctor_id || doc.id, true)}
                              disabled={actionLoading === (doc.doctor_id || doc.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verify & Authorize
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApproval(doc.doctor_id || doc.id, false)}
                              disabled={actionLoading === (doc.doctor_id || doc.id)}
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Suspend
                            </button>
                          )}
                        </div>
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

export default AdminDoctorApproval;
