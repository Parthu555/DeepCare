import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { adminAPI } from '../../services/api';
import {
  Users, Search, UserCheck, Stethoscope, Mail, Phone,
  Heart, Calendar, CheckCircle2, Shield
} from 'lucide-react';

interface PatientItem {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  blood_group?: string;
  assigned_doctor_id?: string;
  created_at: string;
}

const AdminPatients: React.FC = () => {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningPatientId, setAssigningPatientId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  useEffect(() => {
    loadData();
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patientsRes, doctorsRes] = await Promise.all([
        adminAPI.listPatients(1, search || undefined),
        adminAPI.listDoctors(1, true),
      ]);
      setPatients(patientsRes.data.items || patientsRes.data || []);
      setDoctors(doctorsRes.data.items || doctorsRes.data || []);
    } catch (err) {
      console.error('Failed to load patient directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDoctor = async (patientId: string) => {
    if (!selectedDoctorId) return;
    try {
      await adminAPI.assignDoctorToPatient(patientId, selectedDoctorId);
      setAssigningPatientId(null);
      setSelectedDoctorId('');
      await loadData();
    } catch (err) {
      console.error('Failed to assign doctor:', err);
      alert('Error assigning doctor to patient.');
    }
  };

  return (
    <DashboardLayout title="Patient Master Index & Doctor Allocation">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-800 to-cyan-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-300" />
              Patient Registry & Care Teams
            </h2>
            <p className="text-teal-100 text-xs mt-1 max-w-xl">
              Centralized patient registry enabling clinical assignment, primary care attribution, and demographic monitoring.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold">
            Registered Patients: <span className="font-bold text-white text-sm">{patients.length}</span>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, ID, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-xs outline-none text-slate-700"
          />
        </div>

        {/* Patients Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse h-16" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Patients Found</h3>
            <p className="text-xs text-slate-500 mt-1">No matching patient records in the database.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4">Patient Name & ID</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Blood Group</th>
                    <th className="p-4">Assigned Doctor</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {patients.map((p) => (
                    <tr key={p.id || p.patient_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div>
                          <span>{p.first_name} {p.last_name}</span>
                          <span className="block text-[10px] text-teal-600 font-mono">{p.patient_id}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-600 space-y-0.5">
                          {p.email && <div>{p.email}</div>}
                          {p.phone && <div className="text-slate-400">{p.phone}</div>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[11px]">
                          {p.blood_group || 'O+'}
                        </span>
                      </td>
                      <td className="p-4">
                        {p.assigned_doctor_id ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                            Dr. ID: {p.assigned_doctor_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {assigningPatientId === (p.patient_id || p.id) ? (
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={selectedDoctorId}
                              onChange={(e) => setSelectedDoctorId(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded text-xs outline-none"
                            >
                              <option value="">Select Doctor</option>
                              {doctors.map((d) => (
                                <option key={d.id || d.doctor_id} value={d.id || d.doctor_id}>
                                  Dr. {d.first_name} {d.last_name} ({d.specialization})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignDoctor(p.patient_id || p.id)}
                              className="px-2 py-1 bg-teal-600 text-white rounded text-xs font-semibold"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setAssigningPatientId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningPatientId(p.patient_id || p.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Assign Doctor
                          </button>
                        )}
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

export default AdminPatients;
