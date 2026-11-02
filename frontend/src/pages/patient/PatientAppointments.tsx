import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { appointmentAPI, AppointmentItem } from '../../services/api';
import {
  Calendar,
  Clock,
  User,
  Plus,
  Video,
  Building,
  Phone,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

const PatientAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Reschedule Modal State
  const [rescheduleApt, setRescheduleApt] = useState<AppointmentItem | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newSlot, setNewSlot] = useState<string>('10:00 AM - 10:30 AM');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduling, setRescheduling] = useState<boolean>(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await appointmentAPI.getMyBookings();
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (aptId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      setActionError(null);
      await appointmentAPI.cancel(aptId, 'Cancelled by patient');
      await loadAppointments();
    } catch (err: any) {
      console.error('Failed to cancel appointment', err);
      setActionError(err.response?.data?.detail || 'Failed to cancel appointment.');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleApt || !newDate) return;

    try {
      setRescheduling(true);
      setActionError(null);
      const isoDateTime = new Date(`${newDate}T09:00:00Z`).toISOString();
      await appointmentAPI.reschedule(rescheduleApt.appointment_id, {
        scheduled_at: isoDateTime,
        time_slot: newSlot,
        reason: rescheduleReason || 'Patient requested alternative slot'
      });
      setRescheduleApt(null);
      setRescheduleReason('');
      await loadAppointments();
    } catch (err: any) {
      console.error('Failed to reschedule', err);
      setActionError(err.response?.data?.detail || 'Failed to reschedule appointment.');
    } finally {
      setRescheduling(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return ['pending', 'confirmed', 'scheduled', 'rescheduled'].includes(a.status);
    return a.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'scheduled':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Pending Review</span>
          </span>
        );
      case 'rescheduled':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rescheduled</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>{status === 'rejected' ? 'Declined' : 'Cancelled'}</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  return (
    <DashboardLayout title="Appointments & Consultations">
      <div className="space-y-6">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-teal-600/40 text-teal-200 text-xs font-medium mb-2 border border-teal-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Pre-Booking System</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <Calendar className="w-7 h-7 text-teal-300" />
              My Clinical Consultations
            </h2>
            <p className="text-teal-100 mt-1 max-w-xl text-sm">
              Schedule appointments with certified radiologists and physicians. Track booking approvals, time slots, and doctor diagnostic notes.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            <Link
              to="/book-appointment"
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-900/30 transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Book New Appointment</span>
            </Link>
          </div>
        </div>

        {/* Action Error Notification */}
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200">
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'active', label: 'Active & Upcoming' },
            { id: 'pending', label: 'Pending Approval' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'rescheduled', label: 'Rescheduled' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse h-48" />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto shadow-sm">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Appointments Found</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6">
              {statusFilter === 'all'
                ? 'You do not have any appointments yet. Click below to book your first clinical consultation.'
                : `No appointments matching "${statusFilter}".`}
            </p>
            <Link
              to="/book-appointment"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Book An Appointment</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAppointments.map((apt) => {
              const canModify = ['pending', 'confirmed', 'rescheduled', 'scheduled'].includes(apt.status.toLowerCase());
              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: ID and Status badge */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {apt.appointment_id}
                        </span>
                        {apt.consultation_type && (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">
                            {apt.consultation_type === 'video' ? (
                              <Video className="w-3 h-3 text-cyan-600" />
                            ) : apt.consultation_type === 'teleconsultation' ? (
                              <Phone className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Building className="w-3 h-3 text-slate-500" />
                            )}
                            <span>{apt.consultation_type.replace('_', ' ')}</span>
                          </span>
                        )}
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>

                    {/* Doctor Info */}
                    <div className="flex items-start space-x-3 mt-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white font-bold text-base shadow-sm">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">
                          {apt.doctor_name || 'Attending Specialist'}
                        </h4>
                        <p className="text-xs text-teal-700 font-semibold">
                          {apt.doctor_specialization || 'Clinical Specialist'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Patient: <span className="font-medium text-slate-700">{apt.patient_name || 'Registered Patient'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Date and Time Slot Details */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 my-4 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-teal-600" />
                          <span className="font-medium text-slate-800">
                            {new Date(apt.scheduled_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-700 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{apt.time_slot || 'Standard Slot'}</span>
                        </div>
                      </div>

                      {apt.symptoms && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <span className="font-semibold text-slate-700">Health Concerns: </span>
                          <span className="text-slate-600 italic">"{apt.symptoms}"</span>
                        </div>
                      )}

                      {apt.notes && (
                        <div className="pt-1.5 text-[11px] text-teal-800 bg-teal-50/60 p-2 rounded-lg border border-teal-100">
                          <span className="font-semibold block flex items-center gap-1">
                            <Info className="w-3 h-3 text-teal-600" /> Notes from Doctor / Clinic:
                          </span>
                          <p className="mt-0.5 whitespace-pre-line">{apt.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canModify && (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setRescheduleApt(apt);
                          setNewDate(new Date(apt.scheduled_at).toISOString().split('T')[0]);
                          setNewSlot(apt.time_slot || '10:00 AM - 10:30 AM');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reschedule</span>
                      </button>

                      <button
                        onClick={() => handleCancel(apt.appointment_id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleApt && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-teal-600" />
                  Request Reschedule
                </h3>
                <button
                  onClick={() => setRescheduleApt(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Rescheduling appointment <span className="font-mono font-bold text-slate-700">{rescheduleApt.appointment_id}</span> with {rescheduleApt.doctor_name}.
              </p>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Preferred Date *
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
                    New Preferred Time Slot *
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason for Rescheduling
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Schedule conflict, traveling..."
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRescheduleApt(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rescheduling}
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {rescheduling ? 'Submitting...' : 'Confirm Reschedule'}
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

export default PatientAppointments;
