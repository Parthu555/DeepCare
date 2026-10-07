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
  approveReport: (report_id: string, data: { is_patient_viewable: boolean }) =>
    api.post(`/doctors/reports/${report_id}/approve`, data),
  scheduleAppointment: (data: AppointmentCreate) => api.post('/doctors/appointments', data),
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
  model_name: string;
  model_version: string;
  predictions?: Record<string, number>;
  top_prediction?: string;
  top_confidence?: number;
  gradcam_presigned_url?: string;
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

export interface AppointmentCreate {
  patient_id: string;
  scheduled_at: string;
  duration_minutes?: number;
  purpose?: string;
}
