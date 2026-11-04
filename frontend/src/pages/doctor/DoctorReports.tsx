import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI } from '../../services/api';
import {
  FileText, Download, Calendar, ShieldCheck, CheckCircle2,
  Clock, Search, AlertCircle, FileCheck, Stethoscope,
  User, RefreshCw, Sparkles, Edit3, Check, ChevronRight
} from 'lucide-react';

export interface DoctorReportItem {
  id: string;
  report_id: string;
  patient_id: string;
  patient_name?: string;
  doctor_id: string;
  doctor_name?: string;
  xray_id?: string;
  analysis_id?: string;
  title: string;
  report_type: string;
  summary?: string;
  clinical_findings?: string;
  recommendations?: string;
  ai_analysis_included: boolean;
  status: string;
  is_patient_viewable: boolean;
  pdf_presigned_url?: string;
  approved_at?: string;
  created_at: string;
}

const DoctorReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DoctorReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await doctorAPI.getReports(1, searchQuery);
      setReports(res.data.items || res.data || []);
    } catch (err: any) {
      console.error('Failed to load doctor reports:', err);
      showToast('Error loading reports. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (report: DoctorReportItem) => {
    try {
      setDownloadingId(report.report_id);
      const res = await doctorAPI.downloadReport(report.report_id);
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
      } else if (report.pdf_presigned_url) {
        window.open(report.pdf_presigned_url, '_blank');
      } else {
        showToast('PDF compiling. Please try again in a few seconds.');
      }
    } catch (err) {
      console.error('Failed to download report PDF:', err);
      showToast('Could not download PDF. Report may still be compiling.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleApproveReport = async (reportId: string) => {
    try {
      setApprovingId(reportId);
      await doctorAPI.approveReport(reportId, { is_patient_viewable: true });
      showToast('Report signed, certified, and PDF compiled successfully.');
      await loadReports();
    } catch (err: any) {
      console.error('Failed to approve report:', err);
      showToast('Error finalizing report.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSaveNotes = async (report: DoctorReportItem) => {
    try {
      setSavingNotes(true);
      await doctorAPI.createReport({
        patient_id: report.patient_id,
        xray_id: report.xray_id,
        analysis_id: report.analysis_id,
        title: report.title,
        report_type: report.report_type,
        summary: report.summary,
        clinical_findings: editingNotes,
        recommendations: report.recommendations,
        ai_analysis_included: report.ai_analysis_included,
      });
      showToast('Physician observations updated successfully.');
      setEditingReportId(null);
      await loadReports();
    } catch (err) {
      console.error('Failed to save notes:', err);
      showToast('Failed to save observations.');
    } finally {
      setSavingNotes(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'draft' && r.status === 'draft') ||
      (statusFilter === 'approved' && r.status === 'approved');

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.report_id.toLowerCase().includes(q) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.clinical_findings && r.clinical_findings.toLowerCase().includes(q)) ||
      (r.patient_id && r.patient_id.toLowerCase().includes(q)) ||
      (r.patient_name && r.patient_name.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const totalReports = reports.length;
  const approvedCount = reports.filter((r) => r.status === 'approved').length;
  const draftCount = reports.filter((r) => r.status === 'draft').length;

  return (
    <DashboardLayout title="Medical Reports & Diagnosis">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-teal-500/30 text-teal-200 text-[11px] font-bold rounded-full uppercase tracking-wider">
                Doctor Diagnostic Archive
              </span>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2 mt-1">
              <FileCheck className="w-6 h-6 text-teal-300" />
              Physician Certified Reports & Observations
            </h2>
            <p className="text-teal-100 mt-1 max-w-xl text-xs">
              Every clinical note, physician observation, and DenseNet-121 AI inference result is preserved and synchronized with the patient record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center">
              <p className="text-[10px] text-teal-200 uppercase font-semibold">Total Reports</p>
              <p className="text-xl font-bold">{totalReports}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center">
              <p className="text-[10px] text-emerald-300 uppercase font-semibold">Signed</p>
              <p className="text-xl font-bold text-emerald-300">{approvedCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center">
              <p className="text-[10px] text-amber-300 uppercase font-semibold">Drafts</p>
              <p className="text-xl font-bold text-amber-300">{draftCount}</p>
            </div>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-600" />
              {toastMessage}
            </span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Patient, ID, or Notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalReports})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'approved'
                    ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Signed ({approvedCount})
              </button>
              <button
                onClick={() => setStatusFilter('draft')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'draft'
                    ? 'bg-white text-amber-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>

            <button
              onClick={loadReports}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl border border-slate-200 transition-colors"
              title="Refresh Reports"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            </button>

            <button
              onClick={() => navigate('/doctor/ai-studio')}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-200" />
              New AI Analysis
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-sm">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-medium">Loading clinical reports & physician notes...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-800">No Reports Matching Your Criteria</h3>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? 'Try searching with a different patient ID or note keyword.'
                  : 'Start an AI analysis in the Deep Learning Studio to generate clinical reports and add physician notes.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/doctor/ai-studio')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open AI Analysis Studio
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const isApproved = report.status === 'approved';
              const isEditingThis = editingReportId === report.report_id;

              return (
                <div
                  key={report.id || report.report_id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-teal-300 transition-all space-y-4"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        {report.report_id}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isApproved ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Signed & Certified
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            Draft — Awaiting Final Signature
                          </>
                        )}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                        {report.report_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(report.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Main Grid: Details + Observations */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Patient and Title Info (5 cols) */}
                    <div className="lg:col-span-5 space-y-2">
                      <h4 className="font-bold text-slate-800 text-sm leading-snug">{report.title}</h4>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Patient:</span>
                          <span className="font-bold text-slate-800">
                            {report.patient_name || 'Patient'} ({report.patient_id})
                          </span>
                        </div>
                        {report.doctor_name && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Attending:</span>
                            <span className="font-medium text-slate-700">{report.doctor_name}</span>
                          </div>
                        )}
                        {report.summary && (
                          <div className="pt-1.5 border-t border-slate-200/60 text-slate-600 text-[11px] leading-relaxed">
                            {report.summary}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Physician Observations & Interpretive Notes (7 cols) - HIGHLIGHTED */}
                    <div className="lg:col-span-7 bg-teal-50/50 rounded-xl border border-teal-200/70 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
                          Physician Observations & Interpretive Notes
                        </span>

                        {!isApproved && !isEditingThis && (
                          <button
                            onClick={() => {
                              setEditingReportId(report.report_id);
                              setEditingNotes(report.clinical_findings || '');
                            }}
                            className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit Notes
                          </button>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={3}
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            className="w-full p-2 text-xs border border-teal-300 rounded-lg focus:ring-1 focus:ring-teal-500 outline-none resize-none bg-white font-sans"
                            placeholder="Enter detailed physician findings, observations, and clinical correlation..."
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingReportId(null)}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveNotes(report)}
                              disabled={savingNotes}
                              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                            >
                              {savingNotes ? 'Saving...' : 'Save Notes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-lg border border-teal-100 shadow-2xs">
                          {report.clinical_findings ? (
                            <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                              {report.clinical_findings}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              No clinical notes entered yet. Click "Edit Notes" to record your observations.
                            </p>
                          )}
                        </div>
                      )}

                      {report.recommendations && (
                        <div className="text-[11px] text-slate-600 flex items-start gap-1 pt-1">
                          <span className="font-bold text-slate-700">Recommendations:</span>
                          <span className="italic">{report.recommendations}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {!isApproved && (
                      <button
                        onClick={() => handleApproveReport(report.report_id)}
                        disabled={approvingId === report.report_id}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {approvingId === report.report_id ? 'Certifying & Compiling...' : 'Sign & Certify Report'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadPdf(report)}
                      disabled={downloadingId === report.report_id}
                      className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-700" />
                      {downloadingId === report.report_id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorReports;
