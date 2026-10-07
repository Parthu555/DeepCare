import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { patientAPI } from '../../services/api';
import {
  Image, FileText, Stethoscope, Calendar, Bell, Activity,
  TrendingUp, Clock, Shield, User
} from 'lucide-react';
import { format } from 'date-fns';

interface HistoryEvent {
  type: string;
  id: string;
  title: string;
  date: string;
  detail?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  xray: <Image className="w-4 h-4" />,
  report: <FileText className="w-4 h-4" />,
  consultation: <Stethoscope className="w-4 h-4" />,
  appointment: <Calendar className="w-4 h-4" />,
};

const colorMap: Record<string, string> = {
  xray: 'bg-blue-500',
  report: 'bg-emerald-500',
  consultation: 'bg-teal-500',
  appointment: 'bg-purple-500',
};

const PatientDashboard: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      patientAPI.getProfile().catch(() => ({ data: null })),
      patientAPI.getMedicalHistory().catch(() => ({ data: { events: [] } })),
      patientAPI.getNotifications().catch(() => ({ data: [] })),
    ]).then(([profileRes, historyRes, notifRes]) => {
      setProfile(profileRes.data);
      setHistory(historyRes.data?.events || []);
      setNotifications(notifRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Patient Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const recentEvents = history.slice(0, 5);
  const xrayCount = history.filter((e) => e.type === 'xray').length;
  const reportCount = history.filter((e) => e.type === 'report').length;
  const consultationCount = history.filter((e) => e.type === 'consultation').length;
  const appointmentCount = history.filter((e) => e.type === 'appointment').length;

  return (
    <DashboardLayout title="Patient Dashboard">
      {/* Welcome Banner */}
      <div className="deepcare-gradient rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <div className="w-64 h-64 rounded-full bg-white blur-3xl -translate-y-1/2 translate-x-1/4" />
        </div>
        <p className="text-teal-100 text-sm font-medium mb-1">Good day,</p>
        <h2 className="text-2xl font-bold mb-1">
          {profile?.first_name} {profile?.last_name}
        </h2>
        <div className="flex items-center gap-2 mt-3">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Patient ID: <strong>{profile?.patient_id}</strong></span>
          </div>
          {profile?.blood_group && (
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
              Blood: <strong>{profile.blood_group}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'X-Rays', count: xrayCount, icon: <Image className="w-6 h-6 text-blue-500" />, color: 'bg-blue-50' },
          { label: 'Reports', count: reportCount, icon: <FileText className="w-6 h-6 text-emerald-500" />, color: 'bg-emerald-50' },
          { label: 'Consultations', count: consultationCount, icon: <Stethoscope className="w-6 h-6 text-teal-500" />, color: 'bg-teal-50' },
          { label: 'Appointments', count: appointmentCount, icon: <Calendar className="w-6 h-6 text-purple-500" />, color: 'bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className={`p-3 rounded-xl ${stat.color} w-fit mb-3`}>
              {stat.icon}
            </div>
            <p className="text-3xl font-bold text-slate-800">{stat.count}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Medical History Timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              Recent Medical Activity
            </h3>
          </div>
          {recentEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No medical activity yet</p>
            </div>
          ) : (
            <div className="relative">
              {recentEvents.map((event, i) => (
                <div key={event.id} className="timeline-item">
                  <div className={`timeline-dot ${colorMap[event.type] || 'bg-slate-400'}`} />
                  <div className="ml-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`badge-info`}>{event.type}</span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(event.date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{event.title}</p>
                    {event.detail && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{event.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-5">
            <Bell className="w-5 h-5 text-teal-600" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto bg-teal-500 text-white text-xs rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h3>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 6).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border text-sm ${
                    !notif.is_read
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <p className="font-medium text-slate-700">{notif.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {format(new Date(notif.created_at), 'dd MMM, HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
