import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { appointmentAPI, AppointmentItem, AppointmentDoctor } from '../../services/api';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  Search,
  Filter,
  BarChart3,
  Building,
  Video,
  Phone,
  Sparkles,
  ShieldCheck,
  Edit
} from 'lucide-react';

const AdminAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [stats, setStats] = useState<any>({
    total_bookings: 0,
    pending_requests: 0,
    confirmed_appointments: 0,
    rescheduled_appointments: 0,
    cancelled_appointments: 0,
    completed_appointments: 0,
    today_appointments: 0,
  });
  const [doctors, setDoctors] = useState<AppointmentDoctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Admin Override Modal
  const [editingApt, setEditingApt] = useState<AppointmentItem | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('confirmed');
  const [adminNote, setAdminNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apptsRes, statsRes, docsRes] = await Promise.all([
        appointmentAPI.getAdminAppointments({ page_size: 50 }),
        appointmentAPI.getAdminStats(),
        appointmentAPI.getDoctors(),
      ]);
      setAppointments(apptsRes.data.items || []);
      setStats(statsRes.data || {});
      setDoctors(docsRes.data || []);
    } catch (err) {
      console.error('Failed to load admin appointment data', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to load appointments.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApt) return;

    try {
      setSaving(true);
      await appointmentAPI.adminUpdate(editingApt.appointment_id, {
        status: overrideStatus,
        notes: adminNote.trim() || undefined,
      });
      setFeedbackMsg({
        type: 'success',
        text: `Appointment ${editingApt.appointment_id} updated by administrator.`
      });
      setEditingApt(null);
      setAdminNote('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to override appointment', err);
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update appointment.'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (doctorFilter !== 'all' && a.doctor_id !== doctorFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = a.appointment_id.toLowerCase().includes(q);
      const matchPat = a.patient_name?.toLowerCase().includes(q) || false;
      const matchEmail = a.patient_email?.toLowerCase().includes(q) || false;
      const matchDoc = a.doctor_name?.toLowerCase().includes(q) || false;
      const matchSymp = a.symptoms?.toLowerCase().includes(q) || false;
      return matchId || matchPat || matchEmail || matchDoc || matchSymp;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'scheduled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Confirmed</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Pending</span>
          </span>
        );
      case 'rescheduled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
            <RotateCcw className="w-3 h-3" />
            <span>Rescheduled</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            Completed
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3" />
            <span>{status === 'rejected' ? 'Declined' : 'Cancelled'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="System Appointment Management">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-medium mb-2 border border-indigo-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Administrative Operations & Governance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <Calendar className="w-7 h-7 text-indigo-300" />
              Appointment Scheduling & Capacity Monitoring
            </h2>
            <p className="text-slate-300 mt-1 max-w-xl text-sm">
              Hospital-wide monitoring of patient pre-booking requests, doctor schedules, time slot allocations, and capacity.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Total Bookings
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {stats.total_bookings}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm text-center bg-amber-50/20">
            <span className="text-xs uppercase font-bold text-amber-700 tracking-wider block">
              Pending
            </span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {stats.pending_requests}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm text-center bg-emerald-50/20">
            <span className="text-xs uppercase font-bold text-emerald-700 tracking-wider block">
              Confirmed
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {stats.confirmed_appointments}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-cyan-200 shadow-sm text-center bg-cyan-50/20">
            <span className="text-xs uppercase font-bold text-cyan-700 tracking-wider block">
              Rescheduled
            </span>
            <span className="text-2xl font-black text-cyan-600 mt-1 block">
              {stats.rescheduled_appointments}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm text-center bg-rose-50/20">
            <span className="text-xs uppercase font-bold text-rose-700 tracking-wider block">
              Cancelled
            </span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">
              {stats.cancelled_appointments}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm text-center bg-indigo-50/20">
            <span className="text-xs uppercase font-bold text-indigo-700 tracking-wider block">
              Today's Slots
            </span>
            <span className="text-2xl font-black text-indigo-600 mt-1 block">
              {stats.today_appointments}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by ID, patient name, email, symptoms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Doctor Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                Doctor:
              </span>
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              >
                <option value="all">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'pending', label: 'Pending Requests' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'rescheduled', label: 'Rescheduled' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No appointments matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Appointment ID</th>
                    <th className="py-3 px-3">Patient Information</th>
                    <th className="py-3 px-3">Assigned Doctor</th>
                    <th className="py-3 px-3">Date & Time Slot</th>
                    <th className="py-3 px-3">Mode</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                        {apt.appointment_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">
                          {apt.patient_name || 'Anonymous'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {apt.patient_id ? (
                            <span className="text-teal-700 font-semibold">{apt.patient_id}</span>
                          ) : (
                            <span className="text-amber-700">Guest</span>
                          )}
                          {apt.patient_email ? ` • ${apt.patient_email}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {apt.doctor_name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {apt.doctor_specialization || 'Radiologist'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-800 block">
                          {new Date(apt.scheduled_at).toLocaleDateString()}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {apt.time_slot || 'Standard'}
                        </span>
                      </td>
                      <td className="py-3 px-3 capitalize">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                          {apt.consultation_type?.replace('_', ' ') || 'In-Person'}
                        </span>
                      </td>
                      <td className="py-3 px-3">{getStatusBadge(apt.status)}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setEditingApt(apt);
                            setOverrideStatus(apt.status || 'confirmed');
                            setAdminNote(apt.notes || '');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition inline-flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3 text-slate-500" />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Admin Override Modal */}
        {editingApt && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Admin Appointment Override
                </h3>
                <button
                  onClick={() => setEditingApt(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl my-4 text-xs space-y-1">
                <p>
                  <span className="text-slate-500">Appointment ID:</span>{' '}
                  <span className="font-mono font-bold text-indigo-700">
                    {editingApt.appointment_id}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Patient:</span>{' '}
                  <span className="font-bold text-slate-900">{editingApt.patient_name}</span> (
                  {editingApt.patient_id || 'Guest'})
                </p>
                <p>
                  <span className="text-slate-500">Assigned Doctor:</span>{' '}
                  <span className="font-medium text-slate-900">{editingApt.doctor_name}</span>
                </p>
              </div>

              <form onSubmit={handleAdminOverrideSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Override Status *
                  </label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected / Declined</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Administrative Notes & Auditing Log
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter administrative rationale for this status update..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingApt(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Apply Admin Override'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAppointments;
