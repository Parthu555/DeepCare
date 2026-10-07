import React, { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI, ConsultationCreate } from '../../services/api';
import {
  ClipboardList, Plus, Calendar, User, CheckCircle2,
  AlertCircle, Stethoscope, Save
} from 'lucide-react';

const DoctorConsultations: React.FC = () => {
  const [patientId, setPatientId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim() || !chiefComplaint.trim()) {
      setError('Patient ID and Chief Complaint are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const payload: ConsultationCreate = {
        patient_id: patientId.trim(),
        consultation_date: new Date().toISOString(),
        chief_complaint: chiefComplaint,
        assessment,
        plan,
        follow_up_required: followUp,
      };

      await doctorAPI.createConsultation(payload);
      setSuccess(true);
      setChiefComplaint('');
      setAssessment('');
      setPlan('');
    } catch (err: any) {
      console.error('Failed to create consultation:', err);
      setError(err?.response?.data?.detail || 'Failed to save clinical encounter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Clinical Consultations">
      <div className="max-w-3xl space-y-6">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-200" />
              New Patient Encounter & Consultation
            </h2>
            <p className="text-teal-100 text-xs mt-1">
              Document subjective complaints, objective exam findings, diagnostic assessments, and therapeutic plans.
            </p>
          </div>
        </div>

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Clinical encounter logged successfully into patient EHR.
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Patient DeepCare ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PAT-2026-0001"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Encounter Date
              </label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleDateString()}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Chief Complaint & Symptoms *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acute dyspnea, non-productive cough for 5 days, low-grade fever..."
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Clinical Assessment & Diagnostic Impression
            </label>
            <textarea
              rows={3}
              placeholder="Physical examination notes, breath sounds, lung auscultation, differential diagnosis..."
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Management Plan & E-Prescriptions
            </label>
            <textarea
              rows={3}
              placeholder="Prescribed medications, dosage, lab tests ordered, lifestyle recommendations..."
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="followUp"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
            />
            <label htmlFor="followUp" className="text-sm font-semibold text-slate-700 cursor-pointer">
              Schedule follow-up consultation required in 7-14 days
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Record Consultation'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default DoctorConsultations;
