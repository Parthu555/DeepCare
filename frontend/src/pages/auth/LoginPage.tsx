import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';
import {
  Activity, Eye, EyeOff, HeartPulse, Lock, Mail,
  AlertCircle, CheckCircle, User, Stethoscope, ChevronRight
} from 'lucide-react';

type AuthMode = 'login' | 'register-patient' | 'register-doctor';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    specialization: '',
    gender: '',
    blood_group: '',
    phone: '',
    license_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    clearError();
    setFormError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    clearError();
    const ok = await login(form.email, form.password);
    if (ok) {
      const role = useAuthStore.getState().role;
      if (role === 'patient') navigate('/patient/dashboard');
      else if (role === 'doctor') navigate('/doctor/dashboard');
      else if (role === 'admin') navigate('/admin/dashboard');
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    clearError();
    setIsSubmitting(true);
    try {
      const res = await authAPI.registerPatient({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender || undefined,
        blood_group: form.blood_group || undefined,
        phone: form.phone || undefined,
      });
      setSuccessMsg(res.data.detail || 'Registration successful! You can now log in.');
      setMode('login');
    } catch (err: any) {
      let msg = 'Registration failed. Please check your information and try again.';
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || d.message).join(', ');
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    clearError();
    setIsSubmitting(true);
    try {
      const res = await authAPI.registerDoctor({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        specialization: form.specialization,
        license_number: form.license_number || undefined,
        phone: form.phone || undefined,
      });
      setSuccessMsg(res.data.detail || 'Doctor registration submitted. Awaiting admin approval.');
      setMode('login');
    } catch (err: any) {
      let msg = 'Doctor registration failed. Please check your information and try again.';
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || d.message).join(', ');
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 deepcare-gradient flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <HeartPulse className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">DeepCare</h1>
              <p className="text-teal-100 text-sm">Intelligent Healthcare Platform</p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { icon: '🩺', title: 'AI-Powered X-Ray Analysis', desc: 'DenseNet121 chest X-ray classification with Grad-CAM visualization' },
              { icon: '🔒', title: 'Secure Medical Records', desc: 'HIPAA-aligned, encrypted storage on Amazon S3' },
              { icon: '☁️', title: 'AWS Cloud Infrastructure', desc: 'EC2, RDS, S3, CloudWatch, IAM — production-grade' },
              { icon: '📊', title: 'Real-Time Monitoring', desc: 'CloudWatch dashboards with automated alerting' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-2xl mt-0.5">{item.icon}</div>
                <div>
                  <h3 className="text-white font-semibold">{item.title}</h3>
                  <p className="text-teal-100 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-teal-100 text-xs">
            DeepCare is a clinical decision support platform. AI analysis is not a substitute for professional medical diagnosis.
          </p>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <HeartPulse className="w-8 h-8 text-teal-600" />
            <span className="text-2xl font-bold text-slate-800">DeepCare</span>
          </div>

          {/* Tabs */}
          {mode === 'login' && (
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome back</h2>
              <p className="text-slate-500">Sign in to your DeepCare account</p>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-700 text-sm">{successMsg}</p>
            </div>
          )}

          {/* Error Message */}
          {(formError || error) && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{formError || error}</p>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" name="email" value={form.email}
                    onChange={handleChange} required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-slate-800 transition"
                    placeholder="you@hospital.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password" value={form.password}
                    onChange={handleChange} required
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-slate-800 transition"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-teal-200">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Sign In <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* Patient Registration */}
          {mode === 'register-patient' && (
            <form onSubmit={handleRegisterPatient} className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Patient Registration</h2>
              <p className="text-slate-500 text-sm mb-4">A unique Patient ID will be generated for you.</p>
              <div className="grid grid-cols-2 gap-4">
                <input name="first_name" value={form.first_name} onChange={handleChange} required
                  placeholder="First Name" className="col-span-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
                <input name="last_name" value={form.last_name} onChange={handleChange} required
                  placeholder="Last Name" className="col-span-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              </div>
              <input type="email" name="email" value={form.email} onChange={handleChange} required
                placeholder="Email address" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8}
                placeholder="Password (min 8 chars, 1 uppercase, 1 digit)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <div className="grid grid-cols-2 gap-4">
                <select name="gender" value={form.gender} onChange={handleChange}
                  className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-600">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <select name="blood_group" value={form.blood_group} onChange={handleChange}
                  className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-600">
                  <option value="">Blood Group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <input name="phone" value={form.phone} onChange={handleChange}
                placeholder="Phone (optional)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <button type="submit" disabled={isSubmitting || isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-teal-200">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  'Create Patient Account'
                )}
              </button>
            </form>
          )}

          {/* Doctor Registration */}
          {mode === 'register-doctor' && (
            <form onSubmit={handleRegisterDoctor} className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Doctor Registration</h2>
              <p className="text-slate-500 text-sm mb-4">Requires admin approval before access is granted.</p>
              <div className="grid grid-cols-2 gap-4">
                <input name="first_name" value={form.first_name} onChange={handleChange} required
                  placeholder="First Name" className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
                <input name="last_name" value={form.last_name} onChange={handleChange} required
                  placeholder="Last Name" className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              </div>
              <input type="email" name="email" value={form.email} onChange={handleChange} required
                placeholder="Email" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8}
                placeholder="Password (min 8 chars, 1 uppercase, 1 digit)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <input name="specialization" value={form.specialization} onChange={handleChange} required
                placeholder="Specialization (e.g., Radiologist)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              <div className="grid grid-cols-2 gap-4">
                <input name="license_number" value={form.license_number} onChange={handleChange}
                  placeholder="Medical License No." className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
                <input name="phone" value={form.phone} onChange={handleChange}
                  placeholder="Phone" className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              </div>
              <button type="submit" disabled={isSubmitting || isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-teal-200">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  'Submit for Approval'
                )}
              </button>
            </form>
          )}

          {/* Mode switcher */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            {mode === 'login' ? (
              <div className="space-y-3">
                <p className="text-center text-sm text-slate-500">Don't have an account?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setMode('register-patient'); clearError(); setFormError(''); setSuccessMsg(''); }}
                    className="flex items-center justify-center gap-2 py-2.5 border border-teal-200 text-teal-700 rounded-xl hover:bg-teal-50 transition text-sm font-medium">
                    <User className="w-4 h-4" /> Register as Patient
                  </button>
                  <button onClick={() => { setMode('register-doctor'); clearError(); setFormError(''); setSuccessMsg(''); }}
                    className="flex items-center justify-center gap-2 py-2.5 border border-teal-200 text-teal-700 rounded-xl hover:bg-teal-50 transition text-sm font-medium">
                    <Stethoscope className="w-4 h-4" /> Register as Doctor
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setMode('login'); clearError(); setFormError(''); setSuccessMsg(''); }}
                className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium">
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
