import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { appointmentAPI, AppointmentItem } from '../../services/api';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  Search,
  Phone,
  Mail,
  Building,
  Video,
  FileText,
  Sparkles,
  Check,
  X
} from 'lucide-react';

const DoctorAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approval / Action Modal State
  const [activeApt, setActiveApt] = useState<AppointmentItem | null>(null);
  const [modalMode, setModalMode] = useState<'confirm' | 'reject' | 'reschedule' | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newSlot, setNewSlot] = useState<string>('10:00 AM - 10:30 AM');
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await appointmentAPI.getDoctorAppointments();
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Failed to load doctor appointments:', err);
      setActionMsg({ type: 'error', text: 'Failed to load appointments.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApt || !modalMode) return;

    try {
      setUpdating(true);
      setActionMsg(null);

      let targetStatus = 'confirmed';
      let payload: any = {
        status: 'confirmed',
        notes: doctorNotes.trim() || undefined,
      };

      if (modalMode === 'reject') {
        payload.status = 'rejected';
        targetStatus = 'rejected';
      } else if (modalMode === 'reschedule') {
        payload.status = 'rescheduled';
        targetStatus = 'rescheduled';
        if (newDate) {
          payload.scheduled_at = new Date(`${newDate}T09:00:00Z`).toISOString();
        }
        payload.time_slot = newSlot;
      }

      await appointmentAPI.updateDoctorStatus(activeApt.appointment_id, payload);
      setActionMsg({
        type: 'success',
        text: `Appointment ${activeApt.appointment_id} has been ${targetStatus} successfully.`
      });
      setActiveApt(null);
      setModalMode(null);
      setDoctorNotes('');
      await loadAppointments();
    } catch (err: any) {
      console.error('Failed to update status', err);
      setActionMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update appointment status.'
      });
    } finally {
      setUpdating(false);
    }
  };

  const pendingList = appointments.filter((a) => a.status.toLowerCase() === 'pending');
  const confirmedList = appointments.filter((a) => ['confirmed', 'scheduled'].includes(a.status.toLowerCase()));
  const rescheduledList = appointments.filter((a) => a.status.toLowerCase() === 'rescheduled');

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = a.appointment_id.toLowerCase().includes(q);
      const matchPat = a.patient_name?.toLowerCase().includes(q) || false;
      const matchSymp = a.symptoms?.toLowerCase().includes(q) || false;
      const matchPatId = a.patient_id?.toLowerCase().includes(q) || false;
      return matchId || matchPat || matchSymp || matchPatId;
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
            <span>Pending Request</span>
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  return (
    <DashboardLayout title="Doctor Appointments & Consultations">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-800 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-teal-500/30 text-teal-300 text-xs font-medium mb-2 border border-teal-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Attending Physician Clinical Workspace</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <Calendar className="w-7 h-7 text-teal-300" />
              Pre-Booking Requests & Clinical Schedule
            </h2>
            <p className="text-slate-300 mt-1 max-w-xl text-sm">
              Review and approve incoming patient appointment pre-bookings, manage consultation time slots, and schedule follow-ups.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-center">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
              <span className="text-xl font-extrabold text-amber-300">{pendingList.length}</span>
              <span className="text-[11px] block text-slate-300 uppercase tracking-wider font-semibold">
                Pending
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
              <span className="text-xl font-extrabold text-emerald-300">{confirmedList.length}</span>
              <span className="text-[11px] block text-slate-300 uppercase tracking-wider font-semibold">
                Confirmed
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
              <span className="text-xl font-extrabold text-cyan-300">{appointments.length}</span>
              <span className="text-[11px] block text-slate-300 uppercase tracking-wider font-semibold">
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMsg && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
              actionMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>{actionMsg.text}</span>
            </div>
            <button
              onClick={() => setActionMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: High Priority Pending Requests */}
        {pendingList.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Action Required: Pending Pre-Booking Requests ({pendingList.length})
                </h3>
              </div>
              <span className="text-xs text-amber-800 font-semibold bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                Awaiting Doctor Approval
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingList.map((apt) => (
                <div
                  key={apt.id}
                  className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {apt.appointment_id}
                      </span>
                      <span className="text-xs text-slate-500">
                        Requested: {new Date(apt.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-3 flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                        {apt.patient_name?.[0] || 'P'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-base truncate">
                          {apt.patient_name || 'Anonymous Patient'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {apt.patient_id ? (
                            <span className="font-semibold text-teal-700">ID: {apt.patient_id}</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">New / Guest Pre-Booking</span>
                          )}
                          {apt.patient_age ? ` • Age: ${apt.patient_age}` : ''}
                          {apt.patient_gender ? ` • ${apt.patient_gender}` : ''}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                          {apt.patient_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {apt.patient_phone}
                            </span>
                          )}
                          {apt.patient_email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {apt.patient_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 mt-3 text-xs space-y-1.5 text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Requested Time:</span>
                        <span className="font-bold text-slate-900">
                          {new Date(apt.scheduled_at).toLocaleDateString()} ({apt.time_slot || 'Standard'})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Mode:</span>
                        <span className="capitalize font-semibold text-teal-700">
                          {apt.consultation_type?.replace('_', ' ') || 'In-Person'}
                        </span>
                      </div>
                      {apt.symptoms && (
                        <div className="pt-1.5 border-t border-slate-200">
                          <span className="text-slate-500 block">Reported Symptoms:</span>
                          <p className="text-slate-800 font-medium italic mt-0.5">"{apt.symptoms}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Doctor Quick Action Buttons */}
                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setActiveApt(apt);
                        setModalMode('confirm');
                        setDoctorNotes('Pre-booking approved by attending doctor.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept / Confirm</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveApt(apt);
                        setModalMode('reschedule');
                        setNewDate(new Date(apt.scheduled_at).toISOString().split('T')[0]);
                        setNewSlot(apt.time_slot || '10:00 AM - 10:30 AM');
                        setDoctorNotes('Alternative time slot proposed by doctor.');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveApt(apt);
                        setModalMode('reject');
                        setDoctorNotes('Doctor unavailable for this case.');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: All Doctor Appointments / Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Consultation Schedule & Archive</h3>
              <p className="text-xs text-slate-500">Filter appointments across your patient caseload.</p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, ID, symptoms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200">
            {[
              { id: 'all', label: 'All Appointments' },
              { id: 'pending', label: 'Pending Approval' },
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
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table / List View */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No appointments matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Ref ID</th>
                    <th className="py-3 px-3">Patient Details</th>
                    <th className="py-3 px-3">Date & Time Slot</th>
                    <th className="py-3 px-3">Consultation Mode</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-teal-700">
                        {apt.appointment_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">
                          {apt.patient_name || 'Anonymous'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {apt.patient_id ? `ID: ${apt.patient_id}` : 'Guest Patient'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          <span>{new Date(apt.scheduled_at).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {apt.time_slot || 'Standard Slot'}
                        </span>
                      </td>
                      <td className="py-3 px-3 capitalize">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                          {apt.consultation_type?.replace('_', ' ') || 'In-Person'}
                        </span>
                      </td>
                      <td className="py-3 px-3">{getStatusBadge(apt.status)}</td>
                      <td className="py-3 px-3 text-right">
                        {apt.status === 'pending' ? (
                          <button
                            onClick={() => {
                              setActiveApt(apt);
                              setModalMode('confirm');
                              setDoctorNotes('Pre-booking approved by attending doctor.');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] shadow-sm transition"
                          >
                            Review & Accept
                          </button>
                        ) : apt.status === 'confirmed' ? (
                          <button
                            onClick={() => {
                              setActiveApt(apt);
                              setModalMode('reject');
                              setDoctorNotes('Consultation marked completed.');
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition"
                          >
                            Manage
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Finalized</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Doctor Status / Confirmation Modal */}
        {activeApt && modalMode && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  {modalMode === 'confirm' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Approve Appointment Request
                    </>
                  ) : modalMode === 'reject' ? (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      Decline Appointment Request
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5 text-cyan-600" />
                      Reschedule Appointment
                    </>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setActiveApt(null);
                    setModalMode(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl my-4 text-xs space-y-1">
                <p>
                  <span className="text-slate-500">Appointment:</span>{' '}
                  <span className="font-mono font-bold text-teal-700">{activeApt.appointment_id}</span>
                </p>
                <p>
                  <span className="text-slate-500">Patient:</span>{' '}
                  <span className="font-bold text-slate-900">{activeApt.patient_name}</span> (
                  {activeApt.patient_id || 'Guest'})
                </p>
                <p>
                  <span className="text-slate-500">Requested Time:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {new Date(activeApt.scheduled_at).toLocaleDateString()} at{' '}
                    {activeApt.time_slot || 'Standard'}
                  </span>
                </p>
              </div>

              <form onSubmit={handleStatusSubmit} className="space-y-4">
                {modalMode === 'reschedule' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alternative Date *
                      </label>
                      <input
                        type="date"
                        min={minDateStr}
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alternative Time Slot *
                      </label>
                      <select
                        value={newSlot}
                        onChange={(e) => setNewSlot(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                        required
                      >
                        {[
                          '09:00 AM - 09:30 AM',
                          '10:00 AM - 10:30 AM',
                          '11:00 AM - 11:30 AM',
                          '02:00 PM - 02:30 PM',
                          '03:00 PM - 03:30 PM',
                          '04:00 PM - 04:30 PM',
                        ].map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor Notes / Clinical Instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add preparation notes (e.g. bring previous X-rays, fast for 4 hours, etc.)..."
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveApt(null);
                      setModalMode(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition disabled:opacity-50 ${
                      modalMode === 'reject'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {updating
                      ? 'Processing...'
                      : modalMode === 'confirm'
                      ? 'Confirm & Notify Patient'
                      : modalMode === 'reject'
                      ? 'Confirm Decline'
                      : 'Propose Reschedule'}
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

export default DoctorAppointments;
