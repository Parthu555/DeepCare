import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { patientAPI } from '../../services/api';
import {
  FileText, Download, Calendar, ShieldCheck, CheckCircle2,
  Clock, Search, AlertCircle, FileCheck, Stethoscope
} from 'lucide-react';

interface MedicalReportItem {
  id: string;
  report_id: string;
  title: string;
  report_type: string;
  summary: string;
  clinical_findings: string;
  recommendations: string;
  ai_analysis_included: boolean;
  status: string;
  doctor_signed: boolean;
  created_at: string;
  pdf_s3_key?: string;
}

const PatientReports: React.FC = () => {
  const [reports, setReports] = useState<MedicalReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<MedicalReportItem | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await patientAPI.getReports(1);
      setReports(res.data.items || res.data || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (reportId: string) => {
    try {
      setDownloadingId(reportId);
      const res = await patientAPI.downloadReport(reportId);
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      console.error('Failed to download report PDF:', err);
      alert('Could not download PDF. Report might be in draft status.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout title="Medical Reports & Diagnosis">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-cyan-700 to-blue-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-cyan-200" />
              Verified Clinical Reports
            </h2>
            <p className="text-cyan-100 mt-1 max-w-xl text-sm">
              Digitally certified medical reports compiled from clinical observations, radiologist reviews, and DeepCare AI inference models.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-300" />
            <span>HIPAA Compliant Records</span>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-6 rounded-xl border border-slate-200 animate-pulse h-28"></div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Medical Reports Found</h3>
            <p className="text-slate-500 text-sm mt-1">
              Once your physician finalizes your diagnostic consultation and signs the report, you will find it here with full PDF export capabilities.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id || report.report_id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{report.title}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {report.report_type || 'Radiology & Clinical'}
                    </span>
                    {report.doctor_signed ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Doctor Certified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Draft Pending
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 text-sm line-clamp-2">{report.summary || report.clinical_findings}</p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    <span>Report ID: {report.report_id || report.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(report.id || report.report_id)}
                    disabled={downloadingId === (report.id || report.report_id)}
                    className="flex-1 md:flex-none px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingId === (report.id || report.report_id) ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedReport.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Report ID: {selectedReport.report_id || selectedReport.id}</p>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Findings</h4>
                  <p className="text-sm text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-line">
                    {selectedReport.clinical_findings || 'No specific findings logged.'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Physician Recommendations & Follow-Up</h4>
                  <p className="text-sm text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-line">
                    {selectedReport.recommendations || 'Regular monitoring recommended.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => handleDownloadPdf(selectedReport.id || selectedReport.report_id)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export Official PDF
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientReports;
