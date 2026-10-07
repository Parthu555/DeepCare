import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI } from '../../services/api';
import {
  Users, Activity, FileText, Image, Calendar,
  Search, Upload, Brain, CheckCircle, Clock, TrendingUp
} from 'lucide-react';

const DoctorDashboard: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    doctorAPI.getProfile()
      .then((res) => { setProfile(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientSearch.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await doctorAPI.searchPatient(patientSearch.trim());
      setSearchResult(res.data);
    } catch (err: any) {
      setSearchError(err?.response?.data?.detail || 'Patient not found');
    } finally {
      setSearching(false);
    }
  };

  const handleAssignPatient = async (patient_id: string) => {
    try {
      await doctorAPI.assignPatient(patient_id);
      setSearchResult({ ...searchResult, assigned: true });
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Assignment failed');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Doctor Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Doctor Dashboard">
      {/* Welcome */}
      <div className="deepcare-gradient rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <div className="w-64 h-64 rounded-full bg-white blur-3xl -translate-y-1/2 translate-x-1/4" />
        </div>
        <p className="text-teal-100 text-sm font-medium mb-1">Welcome,</p>
        <h2 className="text-2xl font-bold mb-1">
          Dr. {profile?.first_name} {profile?.last_name}
        </h2>
        <p className="text-teal-100 text-sm">{profile?.specialization}</p>
        <div className="flex gap-3 mt-3">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
            ID: <strong>{profile?.doctor_id}</strong>
          </div>
          <div className={`rounded-lg px-3 py-1.5 text-sm ${
            profile?.is_approved
              ? 'bg-emerald-500/30'
              : 'bg-amber-500/30'
          }`}>
            {profile?.is_approved ? '✓ Approved' : '⏳ Pending Approval'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Upload X-Ray', icon: <Upload className="w-6 h-6 text-blue-500" />, color: 'bg-blue-50', href: '/doctor/xrays/upload' },
          { label: 'AI Analysis', icon: <Brain className="w-6 h-6 text-purple-500" />, color: 'bg-purple-50', href: '/doctor/analyses' },
          { label: 'Create Report', icon: <FileText className="w-6 h-6 text-emerald-500" />, color: 'bg-emerald-50', href: '/doctor/reports' },
          { label: 'Schedule Appointment', icon: <Calendar className="w-6 h-6 text-teal-500" />, color: 'bg-teal-50', href: '/doctor/appointments' },
        ].map((action) => (
          <a key={action.label} href={action.href}
            className="stat-card cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-transform duration-150">
            <div className={`p-3 rounded-xl ${action.color} w-fit mb-3`}>{action.icon}</div>
            <p className="text-sm font-semibold text-slate-700">{action.label}</p>
          </a>
        ))}
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-teal-600" />
          Search Patient by ID
        </h3>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Enter Patient ID (e.g., DC-20241015-A3F2)"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-slate-800"
          />
          <button type="submit" disabled={searching}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition disabled:opacity-60 flex items-center gap-2">
            {searching ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </form>

        {searchError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {searchError}
          </div>
        )}

        {searchResult && (
          <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800">
                  {searchResult.first_name} {searchResult.last_name}
                </p>
                <p className="text-sm text-slate-500">Patient ID: {searchResult.patient_id}</p>
                {searchResult.gender && (
                  <p className="text-sm text-slate-500 capitalize">Gender: {searchResult.gender}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!searchResult.assigned ? (
                  <button
                    onClick={() => handleAssignPatient(searchResult.patient_id)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition">
                    Assign Patient
                  </button>
                ) : (
                  <span className="badge-success">Assigned ✓</span>
                )}
                <a href={`/doctor/patients/${searchResult.patient_id}`}
                  className="px-4 py-2 bg-white border border-teal-300 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-50 transition">
                  View Records
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Model Status */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-teal-600" />
          AI Analysis Capability
        </h3>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-50 rounded-xl">
            <Brain className="w-8 h-8 text-purple-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800">DenseNet121 Chest X-Ray Classifier</p>
            <p className="text-sm text-slate-500 mt-1">
              Multi-label classification for 14 chest pathologies including Pneumonia, 
              Atelectasis, Cardiomegaly, Effusion, and more.
            </p>
            <p className="text-xs text-amber-600 mt-2 font-medium">
              ⚠ AI predictions are clinical decision support only — not diagnostic conclusions.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
