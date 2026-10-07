import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  HeartPulse, LayoutDashboard, FileText, Image, Calendar,
  Bell, User, LogOut, ChevronRight, Settings, Activity,
  Stethoscope, Users, ClipboardList, BarChart3, Shield, Menu, X
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const patientNav: NavItem[] = [
  { label: 'Dashboard', href: '/patient/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'My X-Rays', href: '/patient/xrays', icon: <Image className="w-5 h-5" /> },
  { label: 'Medical Reports', href: '/patient/reports', icon: <FileText className="w-5 h-5" /> },
  { label: 'Consultations', href: '/patient/consultations', icon: <Stethoscope className="w-5 h-5" /> },
  { label: 'Appointments', href: '/patient/appointments', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Medical History', href: '/patient/history', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Notifications', href: '/patient/notifications', icon: <Bell className="w-5 h-5" /> },
  { label: 'My Profile', href: '/patient/profile', icon: <User className="w-5 h-5" /> },
];

const doctorNav: NavItem[] = [
  { label: 'Dashboard', href: '/doctor/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Patient Search', href: '/doctor/patients', icon: <Users className="w-5 h-5" /> },
  { label: 'Upload X-Ray', href: '/doctor/xrays/upload', icon: <Image className="w-5 h-5" /> },
  { label: 'AI Analysis', href: '/doctor/analyses', icon: <Activity className="w-5 h-5" /> },
  { label: 'Consultations', href: '/doctor/consultations', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Reports', href: '/doctor/reports', icon: <FileText className="w-5 h-5" /> },
  { label: 'Appointments', href: '/doctor/appointments', icon: <Calendar className="w-5 h-5" /> },
  { label: 'My Profile', href: '/doctor/profile', icon: <User className="w-5 h-5" /> },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Patients', href: '/admin/patients', icon: <Users className="w-5 h-5" /> },
  { label: 'Doctors', href: '/admin/doctors', icon: <Stethoscope className="w-5 h-5" /> },
  { label: 'Departments', href: '/admin/departments', icon: <Settings className="w-5 h-5" /> },
  { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: <Shield className="w-5 h-5" /> },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const { role, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = role === 'patient' ? patientNav : role === 'doctor' ? doctorNav : adminNav;
  const roleLabel = role === 'patient' ? 'Patient Portal' : role === 'doctor' ? 'Doctor Portal' : 'Admin Console';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-auto`}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <HeartPulse className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-lg">DeepCare</span>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-30">
          <button className="lg:hidden text-slate-500 hover:text-slate-700" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          {title && <h1 className="text-xl font-semibold text-slate-800">{title}</h1>}
          <div className="ml-auto flex items-center gap-3">
            <span className={`badge-info capitalize`}>{role}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
