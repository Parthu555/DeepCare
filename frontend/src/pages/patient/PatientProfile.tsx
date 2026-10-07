import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { patientAPI, PatientProfile } from '../../services/api';
import {
  User, Mail, Phone, Calendar, Heart, AlertTriangle,
  Save, CheckCircle2, Shield
} from 'lucide-react';

const PatientProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Partial<PatientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await patientAPI.getProfile();
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to load patient profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSavedSuccess(false);
      const res = await patientAPI.updateProfile({
        phone: profile.phone,
        allergies: profile.allergies,
        chronic_conditions: profile.chronic_conditions,
        blood_group: profile.blood_group,
      });
      setProfile(res.data);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Error updating medical profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Medical Record Profile">
      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-3xl shadow-inner">
            {profile.first_name?.[0] || 'P'}{profile.last_name?.[0] || ''}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-bold text-slate-800">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-sm font-semibold text-teal-600">
              DeepCare ID: <span className="font-mono text-slate-700">{profile.patient_id || 'Generating...'}</span>
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-500" /> Blood Group: {profile.blood_group || 'O+'}
              </span>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Medical profile updated successfully in AWS RDS PostgreSQL.
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
            Demographic & Clinical Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                First Name
              </label>
              <input
                type="text"
                disabled
                value={profile.first_name || ''}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Last Name
              </label>
              <input
                type="text"
                disabled
                value={profile.last_name || ''}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Blood Group
              </label>
              <select
                value={profile.blood_group || ''}
                onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm outline-none"
              >
                <option value="">Select blood group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Known Drug / Environmental Allergies
              </label>
              <textarea
                rows={2}
                value={profile.allergies || ''}
                onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                placeholder="e.g. Penicillin, Sulfa drugs, Latex..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Pre-existing Chronic Conditions
              </label>
              <textarea
                rows={2}
                value={profile.chronic_conditions || ''}
                onChange={(e) => setProfile({ ...profile, chronic_conditions: e.target.value })}
                placeholder="e.g. Asthma, Type 2 Diabetes, Hypertension..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm outline-none resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-teal-600" />
              <span>Encrypted with AWS KMS at rest and in transit</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default PatientProfilePage;
