/**
 * DeepCare API Service Layer
 * Handles all communication with the FastAPI backend.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — redirect to login (except for login requests)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─────────────── Auth ───────────────

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  registerPatient: (data: PatientRegistration) =>
    api.post('/auth/register/patient', data),
  registerDoctor: (data: DoctorRegistration) =>
    api.post('/auth/register/doctor', data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  me: () => api.get('/auth/me'),
};

// ─────────────── Patient ───────────────

export const patientAPI = {
  getProfile: () => api.get('/patients/me'),
  updateProfile: (data: Partial<PatientProfile>) => api.put('/patients/me', data),
  getXrays: (page = 1) => api.get(`/patients/me/xrays?page=${page}`),
  getXrayViewUrl: (xray_id: string) => api.get(`/patients/me/xrays/${xray_id}/view`),
  getReports: (page = 1) => api.get(`/patients/me/reports?page=${page}`),
  downloadReport: (report_id: string) => api.get(`/patients/me/reports/${report_id}/download`),
  getConsultations: (page = 1) => api.get(`/patients/me/consultations?page=${page}`),
  getAppointments: () => api.get('/patients/me/appointments'),
  getNotifications: () => api.get('/patients/me/notifications'),
  getMedicalHistory: () => api.get('/patients/me/history'),
};

// ─────────────── Doctor ───────────────

export const doctorAPI = {
  getProfile: () => api.get('/doctors/me/profile'),
  searchPatient: (patient_id: string) => api.get(`/doctors/patients/search?patient_id=${patient_id}`),
  assignPatient: (patient_id: string) => api.post(`/doctors/patients/${patient_id}/assign`),
  getPatientProfile: (patient_id: string) => api.get(`/doctors/patients/${patient_id}/profile`),
  uploadXray: (formData: FormData) =>
    api.post('/doctors/xrays/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  requestAnalysis: (xray_id: string) => api.post(`/doctors/xrays/${xray_id}/analyze`),
  reviewAnalysis: (analysis_id: string, data: AnalysisReview) =>
    api.put(`/doctors/analyses/${analysis_id}/review`, data),
  createConsultation: (data: ConsultationCreate) => api.post('/doctors/consultations', data),
  createReport: (data: ReportCreate) => api.post('/doctors/reports', data),
  getReports: (page = 1, search = '') =>
    api.get(`/doctors/reports?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getReportById: (report_id: string) => api.get(`/doctors/reports/${report_id}`),
  downloadReport: (report_id: string) => api.get(`/doctors/reports/${report_id}/download`),
  approveReport: (report_id: string, data: { is_patient_viewable: boolean }) =>
    api.post(`/doctors/reports/${report_id}/approve`, data),
  scheduleAppointment: (data: AppointmentCreate) => api.post('/doctors/appointments', data),
  getStorageImages: () => api.get<StorageDatasetImage[]>('/doctors/storage/available-images'),
  importFromStorage: (data: {
    image_id: string;
    patient_id: string;
    view_position?: string;
    clinical_indication?: string;
    body_part?: string;
  }) => api.post<any>('/doctors/xrays/import-from-storage', data),
  getAllXrays: () => api.get<DoctorXrayScanItem[]>('/doctors/xrays/all'),
};

// ─────────────── Admin ───────────────

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  listDoctors: (page = 1, approved?: boolean) => {
    const params = new URLSearchParams({ page: String(page) });
    if (approved !== undefined) params.append('approved', String(approved));
    return api.get(`/admin/doctors?${params}`);
  },
  approveDoctor: (doctor_id: string, approved: boolean) =>
    api.post(`/admin/doctors/${doctor_id}/approval`, { approved }),
  deactivateDoctor: (doctor_id: string) => api.delete(`/admin/doctors/${doctor_id}`),
  listPatients: (page = 1, search?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.append('search', search);
    return api.get(`/admin/patients?${params}`);
  },
  assignDoctorToPatient: (patient_id: string, doctor_id: string) =>
    api.post(`/admin/patients/${patient_id}/assign-doctor?doctor_id=${doctor_id}`),
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (name: string, description?: string) =>
    api.post('/admin/departments', { name, description }),
  getAuditLogs: (page = 1, action?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (action) params.append('action', action);
    return api.get(`/admin/audit-logs?${params}`);
  },
};

// ─────────────── Types ───────────────

export interface PatientRegistration {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  phone?: string;
}

export interface DoctorRegistration {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  specialization: string;
  license_number?: string;
  phone?: string;
  years_experience?: number;
  bio?: string;
}

export interface PatientProfile {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  phone?: string;
  allergies?: string;
  chronic_conditions?: string;
  created_at: string;
}

export interface XrayImage {
  id: string;
  xray_id: string;
  patient_id: string;
  body_part?: string;
  view_position?: string;
  analysis_status: string;
  clinical_indication?: string;
  created_at: string;
  presigned_url?: string;
}

export interface AnalysisResult {
  id: string;
  analysis_id: string;
  xray_id: string;
  patient_id?: string;
  model_name: string;
  model_version: string;
  predictions?: Record<string, number>;
  top_prediction?: string;
  top_confidence?: number;
  gradcam_presigned_url?: string;
  xray_presigned_url?: string;
  status: string;
  doctor_reviewed: boolean;
  doctor_review_notes?: string;
  inference_duration_ms?: number;
  created_at: string;
}

export interface AnalysisReview {
  doctor_review_notes: string;
  doctor_reviewed: boolean;
}

export interface ConsultationCreate {
  patient_id: string;
  consultation_date: string;
  chief_complaint?: string;
  assessment?: string;
  plan?: string;
  follow_up_required?: boolean;
}

export interface ReportCreate {
  patient_id: string;
  xray_id?: string;
  analysis_id?: string;
  title: string;
  report_type?: string;
  summary?: string;
  clinical_findings?: string;
  recommendations?: string;
  ai_analysis_included?: boolean;
}

export interface StorageDatasetImage {
  image_id: string;
  filename: string;
  patient_id?: string;
  finding: string;
  view_position: string;
  file_size_kb: number;
  preview_url: string;
}

export interface DoctorXrayScanItem {
  xray_id: string;
  patient_id: string;
  patient_name: string;
  body_part: string;
  view_position: string;
  analysis_status: string;
  presigned_url?: string;
  created_at: string;
  clinical_indication?: string;
}

// ─────────────── Appointments & Pre-Booking ───────────────

export interface AppointmentDoctor {
  id: string;
  doctor_id: string;
  name: string;
  first_name: string;
  last_name: string;
  specialization: string;
  license_number: string;
  consultation_types: string[];
  available_time_slots: string[];
}

export interface AppointmentItem {
  id: string;
  appointment_id: string;
  patient_id?: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  patient_age?: number;
  patient_gender?: string;
  symptoms?: string;
  consultation_type?: string;
  time_slot?: string;
  scheduled_at: string;
  duration_minutes: number;
  purpose?: string;
  status: 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'scheduled' | 'rejected' | string;
  notes?: string;
  created_at: string;
}

export interface AppointmentCreate {
  patient_id?: string;
  doctor_id: string;
  scheduled_at: string;
  duration_minutes?: number;
  purpose?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  patient_age?: number;
  patient_gender?: string;
  symptoms?: string;
  consultation_type?: string;
  time_slot?: string;
}

export const appointmentAPI = {
  getDoctors: () => api.get<AppointmentDoctor[]>('/appointments/doctors'),
  preBook: (data: AppointmentCreate) => api.post<AppointmentItem>('/appointments/pre-book', data),
  getMyBookings: (params?: { email?: string; patient_id?: string; appointment_id?: string }) =>
    api.get<AppointmentItem[]>('/appointments/my-bookings', { params }),
  getById: (id: string) => api.get<AppointmentItem>(`/appointments/${id}`),
  cancel: (id: string, reason?: string) =>
    api.patch<AppointmentItem>(`/appointments/${id}/cancel`, null, { params: { reason } }),
  reschedule: (id: string, data: { scheduled_at: string; time_slot?: string; reason?: string }) =>
    api.patch<AppointmentItem>(`/appointments/${id}/reschedule`, data),
  getDoctorAppointments: (status_filter?: string) =>
    api.get<AppointmentItem[]>('/appointments/doctor/me', { params: { status_filter } }),
  updateDoctorStatus: (
    id: string,
    data: { status: string; notes?: string; scheduled_at?: string; time_slot?: string }
  ) => api.patch<AppointmentItem>(`/appointments/doctor/${id}/status`, data),
  getAdminAppointments: (params?: {
    status_filter?: string;
    doctor_id?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => api.get<{ items: AppointmentItem[]; total: number; page: number; page_size: number }>('/appointments/admin/all', { params }),
  getAdminStats: () =>
    api.get<{
      total_bookings: number;
      pending_requests: number;
      confirmed_appointments: number;
      rescheduled_appointments: number;
      cancelled_appointments: number;
      completed_appointments: number;
      today_appointments: number;
    }>('/appointments/admin/stats'),
  adminUpdate: (id: string, data: { status?: string; notes?: string; scheduled_at?: string; time_slot?: string }) =>
    api.patch<AppointmentItem>(`/appointments/admin/${id}`, data),
};

