import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Video,
  Building,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { appointmentAPI, AppointmentDoctor, AppointmentItem, patientAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const BookAppointment: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  const [doctors, setDoctors] = useState<AppointmentDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookedAppointment, setBookedAppointment] = useState<AppointmentItem | null>(null);

  // Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [consultationType, setConsultationType] = useState<string>('in_person');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('10:00 AM - 10:30 AM');

  // Patient Info
  const [patientId, setPatientId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [patientEmail, setPatientEmail] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<string>('male');
  const [symptoms, setSymptoms] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Clinical Radiology / Chest Evaluation');

  // Load Doctors and Pre-fill user data if logged in
  useEffect(() => {
    const init = async () => {
      try {
        const docRes = await appointmentAPI.getDoctors();
        const docs = docRes.data || [];
        setDoctors(docs);
        if (docs.length > 0) {
          setSelectedDoctorId(docs[0].doctor_id || docs[0].id);
        }
      } catch (err) {
        console.error('Failed to load doctors', err);
        setErrorMsg('Failed to load doctors. Please try again.');
      } finally {
        setLoadingDoctors(false);
      }

      // If logged in as patient, auto-populate details
      if (isAuthenticated && role === 'patient') {
        try {
          const pRes = await patientAPI.getProfile();
          const pData = pRes.data;
          if (pData) {
            setPatientId(pData.patient_id || '');
            setPatientName(`${pData.first_name || ''} ${pData.last_name || ''}`.trim());
            setPatientPhone(pData.phone || '');
            if (pData.gender) setPatientGender(pData.gender);
            if (pData.date_of_birth) {
              const birth = new Date(pData.date_of_birth);
              const age = new Date().getFullYear() - birth.getFullYear();
              setPatientAge(String(age));
            }
            if (pData.email) {
              setPatientEmail(pData.email);
            }
          }
        } catch (e) {
          console.warn('Could not auto-fetch patient profile', e);
        }
      }
    };

    init();
  }, [isAuthenticated, role]);

  const selectedDoctor = doctors.find(
    (d) => d.doctor_id === selectedDoctorId || d.id === selectedDoctorId
  ) || doctors[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDoctorId) {
      setErrorMsg('Please select a doctor for your appointment.');
      return;
    }
    if (!patientName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!patientEmail.trim() && !patientPhone.trim()) {
      setErrorMsg('Please provide either an email address or phone number.');
      return;
    }

    try {
      setSubmitting(true);
      // Combine date and time slot into ISO scheduled_at
      const isoDateTime = new Date(`${scheduledDate}T09:00:00Z`).toISOString();

      const payload = {
        doctor_id: selectedDoctorId,
        scheduled_at: isoDateTime,
        time_slot: selectedTimeSlot,
        consultation_type: consultationType,
        patient_id: patientId ? patientId.trim() : undefined,
        patient_name: patientName.trim(),
        patient_email: patientEmail ? patientEmail.trim() : undefined,
        patient_phone: patientPhone ? patientPhone.trim() : undefined,
        patient_age: patientAge ? parseInt(patientAge, 10) : undefined,
        patient_gender: patientGender,
        symptoms: symptoms.trim() || 'General Consultation',
        purpose: purpose.trim() || 'Clinical Review',
      };

      const res = await appointmentAPI.preBook(payload);
      setBookedAppointment(res.data);
    } catch (err: any) {
      console.error('Booking failed', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setErrorMsg(
          detail || 'This time slot is already reserved for this doctor. Please choose another time.'
        );
      } else {
        setErrorMsg(detail || 'Failed to submit appointment request. Please verify your details.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2 text-teal-600 font-bold text-xl">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="bg-gradient-to-r from-teal-700 to-cyan-600 bg-clip-text text-transparent">
                DeepCare
              </span>
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200">
              Smart Pre-Booking
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate(`/${role}/dashboard`)}
                className="inline-flex items-center text-sm font-medium text-slate-700 hover:text-teal-600 transition"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Dashboard
              </button>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 px-3.5 py-1.5 rounded-lg transition"
              >
                Sign In to Portal
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Confirmation Modal / Screen */}
        {bookedAppointment ? (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 sm:p-12 text-center max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner border border-emerald-100 mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold mb-3 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Status: Pending Doctor Approval</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Pre-Booking Request Received!
            </h2>
            <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto">
              Your appointment request has been submitted to{' '}
              <span className="font-semibold text-slate-800">{bookedAppointment.doctor_name}</span>.
              You will receive confirmation once approved.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 my-8 text-left space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Appointment Reference ID
                </span>
                <span className="text-base font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {bookedAppointment.appointment_id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500 block">Patient Name</span>
                  <span className="font-medium text-slate-900">{bookedAppointment.patient_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Patient ID</span>
                  <span className="font-medium text-slate-900">
                    {bookedAppointment.patient_id || 'New / Guest Patient'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Requested Date & Slot</span>
                  <span className="font-medium text-slate-900">
                    {new Date(bookedAppointment.scheduled_at).toLocaleDateString()} at{' '}
                    {bookedAppointment.time_slot}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Consultation Mode</span>
                  <span className="font-medium text-slate-900 capitalize">
                    {bookedAppointment.consultation_type?.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {bookedAppointment.symptoms && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 block">Reported Symptoms:</span>
                  <p className="text-slate-700 italic mt-0.5">"{bookedAppointment.symptoms}"</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate('/patient/appointments')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md shadow-teal-500/20 transition flex items-center justify-center"
                >
                  View My Appointments
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md shadow-teal-500/20 transition flex items-center justify-center"
                >
                  Sign In to Track Status
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              )}
              <button
                onClick={() => {
                  setBookedAppointment(null);
                  setSymptoms('');
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm transition"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 sm:p-8">
              <div className="mb-6">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>DeepCare Smart Scheduling</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Schedule Clinical Consultation
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Book an appointment with certified specialists. Existing patients can link their
                  Patient ID for unified EHR records.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Booking Notification:</span>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Select Doctor */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    1. Select Specialist / Attending Physician *
                  </label>
                  {loadingDoctors ? (
                    <div className="h-20 bg-slate-100 animate-pulse rounded-xl" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {doctors.map((doc) => {
                        const isSelected =
                          doc.doctor_id === selectedDoctorId || doc.id === selectedDoctorId;
                        return (
                          <div
                            key={doc.doctor_id}
                            onClick={() => setSelectedDoctorId(doc.doctor_id)}
                            className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start space-x-3 ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50/40 shadow-sm ring-2 ring-teal-500/20'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                isSelected
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Dr
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {doc.name}
                              </p>
                              <p className="text-xs text-teal-700 font-medium">
                                {doc.specialization}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Reg: {doc.license_number}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Consultation Mode */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    2. Consultation Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'in_person', label: 'In-Person Clinic', icon: Building },
                      { id: 'video', label: 'Video Telehealth', icon: Video },
                      { id: 'teleconsultation', label: 'Audio / Phone', icon: Phone },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const active = consultationType === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setConsultationType(mode.id)}
                          className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-1.5 ${
                            active
                              ? 'border-teal-500 bg-teal-50/50 text-teal-800 font-semibold ring-1 ring-teal-500'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span className="text-xs">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Date & Time Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      3. Appointment Date *
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="date"
                        min={minDateStr}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Preferred Time Slot *
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <select
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                        required
                      >
                        {(selectedDoctor?.available_time_slots || [
                          '09:00 AM - 09:30 AM',
                          '10:00 AM - 10:30 AM',
                          '11:00 AM - 11:30 AM',
                          '02:00 PM - 02:30 PM',
                          '03:00 PM - 03:30 PM',
                          '04:00 PM - 04:30 PM',
                        ]).map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Patient Information */}
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    4. Patient Personal & Contact Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Patient ID (Optional or autofilled) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Patient ID (if existing, e.g. PAT-2026-0001)
                      </label>
                      <input
                        type="text"
                        placeholder="Leave blank if new patient"
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          placeholder="john.doe@example.com"
                          value={patientEmail}
                          onChange={(e) => setPatientEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Age */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Age
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        placeholder="e.g. 45"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Gender
                      </label>
                      <select
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Symptoms & Purpose */}
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    5. Clinical Symptoms & Reason for Visit
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Chief Symptoms / Health Concerns *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe what you are experiencing (e.g. shortness of breath, cough, chest discomfort, follow-up after scan)..."
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>HIPAA Compliant & Encrypted</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-500/20 transition flex items-center space-x-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Pre-Booking Request</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Doctor Preview & Policies */}
            <div className="lg:col-span-4 space-y-6">
              {/* Doctor Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Selected Specialist
                </h3>

                <div className="flex items-start space-x-3 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    {selectedDoctor?.first_name?.[0] || 'D'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {selectedDoctor?.name || 'Dr. Specialist'}
                    </h4>
                    <p className="text-xs text-teal-700 font-semibold">
                      {selectedDoctor?.specialization || 'Clinical Specialist'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      License: {selectedDoctor?.license_number || 'Accredited MD'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Consultation Duration:</span>
                    <span className="font-semibold text-slate-800">30 minutes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Imaging Integration:</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      DenseNet-121 Supported
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Explainable AI:</span>
                    <span className="font-semibold text-slate-800">Grad-CAM Heatmaps</span>
                  </div>
                </div>
              </div>

              {/* Guidelines Card */}
              <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
                <div className="flex items-center space-x-2 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>How Pre-Booking Works</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200 mt-3">
                  <li className="flex items-start space-x-2">
                    <span className="w-5 h-5 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 font-bold flex-shrink-0 text-[10px]">
                      1
                    </span>
                    <span>Submit your preferred date, time slot, and health concerns.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-5 h-5 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 font-bold flex-shrink-0 text-[10px]">
                      2
                    </span>
                    <span>
                      Doctor reviews your case and approves or suggests a rescheduled slot.
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-5 h-5 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 font-bold flex-shrink-0 text-[10px]">
                      3
                    </span>
                    <span>
                      Status updates immediately in your Patient Portal with verified notifications.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookAppointment;
