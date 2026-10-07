import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { patientAPI } from '../../services/api';
import {
  Calendar, Clock, User, CheckCircle2, AlertCircle,
  Video, MapPin, Plus, Sparkles
} from 'lucide-react';

interface Appointment {
  id: string;
  doctor_id: string;
  scheduled_at: string;
  status: string;
  purpose?: string;
  notes?: string;
  meeting_url?: string;
  doctor?: {
    first_name: string;
    last_name: string;
    specialization: string;
  };
}

const PatientAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await patientAPI.getAppointments();
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'scheduled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Confirmed
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status || 'Pending'}
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="Clinical Appointments">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6 text-teal-200" />
              Doctor Consultations & Follow-Ups
            </h2>
            <p className="text-teal-100 mt-1 max-w-xl text-sm">
              Schedule in-person reviews or secure telemedicine consultations with certified medical specialists.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-sm font-medium">
            Active Appointments: <span className="font-bold">{appointments.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 animate-pulse h-28"></div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Scheduled Appointments</h3>
            <p className="text-slate-500 text-sm mt-1">
              You do not have any upcoming doctor appointments. Your physician can book your follow-up after analyzing your diagnostic scans.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center font-bold">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">
                        {apt.doctor ? `Dr. ${apt.doctor.first_name} ${apt.doctor.last_name}` : 'Attending Specialist'}
                      </h4>
                      <p className="text-xs text-teal-600 font-semibold">
                        {apt.doctor?.specialization || 'Pulmonology & Radiology'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(apt.status)}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{new Date(apt.scheduled_at).toLocaleString()}</span>
                  </div>
                  {apt.purpose && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Purpose:</span>
                      <span>{apt.purpose}</span>
                    </div>
                  )}
                </div>

                {apt.meeting_url && (
                  <a
                    href={apt.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Video className="w-4 h-4" /> Join Video Telehealth Session
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientAppointments;
