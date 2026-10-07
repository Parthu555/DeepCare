import React, { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI } from '../../services/api';
import {
  Search, User, Heart, Phone, Mail, ShieldAlert,
  UserCheck, AlertCircle, Calendar, Plus, FileText, Image
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DoctorPatientSearch: React.FC = () => {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [patient, setPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdInput.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setPatient(null);
      setAssignSuccess(false);

      const res = await doctorAPI.searchPatient(patientIdInput.trim());
      setPatient(res.data);
    } catch (err: any) {
      console.error('Patient search failed:', err);
      setError(err?.response?.data?.detail || 'Patient not found with this ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!patient) return;
    try {
      setAssigning(true);
      await doctorAPI.assignPatient(patient.patient_id || patient.id);
      setAssignSuccess(true);
    } catch (err: any) {
      console.error('Assignment failed:', err);
      alert(err?.response?.data?.detail || 'Failed to assign patient.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <DashboardLayout title="Patient Directory & Search">
      <div className="space-y-6 max-w-4xl">
        {/* Search Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Lookup Patient by ID</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter the unique DeepCare Patient ID (e.g., <code className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded font-mono">PAT-2026-XXXX</code>) to inspect electronic health records or initiate radiological scans.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Enter Patient ID (e.g. PAT-2026-0001)..."
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search Patient'}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Search Result */}
        {patient && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center font-bold text-2xl text-teal-300">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{patient.first_name} {patient.last_name}</h3>
                  <p className="text-xs text-teal-400 font-mono">ID: {patient.patient_id}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAssign}
                  disabled={assigning || assignSuccess}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  {assignSuccess ? 'Assigned to Your Care' : assigning ? 'Assigning...' : 'Assign to My Care'}
                </button>
                <button
                  onClick={() => navigate('/doctor/xrays/upload', { state: { patientId: patient.patient_id } })}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Image className="w-4 h-4" /> Upload Scan
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Gender / Age</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{patient.gender || 'Not specified'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Blood Group</span>
                  <p className="font-bold text-red-600 text-sm mt-0.5">{patient.blood_group || 'Unknown'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Phone Contact</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{patient.phone || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Registration Date</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {new Date(patient.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> Allergies Alert
                  </h4>
                  <p className="text-sm text-slate-700">
                    {patient.allergies || 'No known medical allergies reported.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Heart className="w-4 h-4 text-teal-600" /> Chronic Medical History
                  </h4>
                  <p className="text-sm text-slate-700">
                    {patient.chronic_conditions || 'No chronic conditions recorded.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorPatientSearch;
