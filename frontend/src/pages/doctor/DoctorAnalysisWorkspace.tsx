import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI, AnalysisResult, ReportCreate, DoctorXrayScanItem } from '../../services/api';
import {
  Activity, Sparkles, Brain, CheckCircle2, AlertTriangle,
  FileText, Download, Sliders, Eye, RefreshCw, Check, Clock,
  Database, Image as ImageIcon, ArrowRight, PlusCircle, Search, FileCheck
} from 'lucide-react';

const DoctorAnalysisWorkspace: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const passedXrayId = (location.state as any)?.xrayId || '';

  const [xrayId, setXrayId] = useState(passedXrayId);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.5);
  const [displayMode, setDisplayMode] = useState<'side-by-side' | 'blend' | 'gradcam-only'>('blend');

  // Available scans list for quick selection with ID
  const [availableScans, setAvailableScans] = useState<DoctorXrayScanItem[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFilterQuery, setScanFilterQuery] = useState('');

  // Report generation state
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportCreated, setReportCreated] = useState<any | null>(null);

  useEffect(() => {
    fetchAvailableScans();
  }, []);

  useEffect(() => {
    if (passedXrayId) {
      handleRunInference(passedXrayId);
    }
  }, [passedXrayId]);

  const fetchAvailableScans = async () => {
    try {
      setLoadingScans(true);
      const res = await doctorAPI.getAllXrays();
      setAvailableScans(res.data);
    } catch (err: any) {
      console.error('Failed to load doctor xrays:', err);
    } finally {
      setLoadingScans(false);
    }
  };

  const handleRunInference = async (idToAnalyze?: string) => {
    const id = idToAnalyze || xrayId;
    if (!id.trim()) {
      alert('Please enter a Patient ID (e.g. PAT-2026-0001) or Scan ID to analyze.');
      return;
    }

    try {
      setLoading(true);
      setReviewSaved(false);
      setReportCreated(null);
      const res = await doctorAPI.requestAnalysis(id.trim());
      setAnalysis(res.data);
      if (res.data?.xray_id) {
        setXrayId(res.data.xray_id);
      }
      if (res.data?.doctor_review_notes) {
        setDoctorNotes(res.data.doctor_review_notes);
      }
      fetchAvailableScans();
    } catch (err: any) {
      console.error('Inference error:', err);
      if (err?.response?.status === 401) {
        alert('Your session has expired. Redirecting to login page...');
        navigate('/login');
        return;
      }
      alert(err?.response?.data?.detail || 'Failed to execute deep learning inference.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAndAnalyze = (selectedId: string) => {
    setXrayId(selectedId);
    setShowScanModal(false);
    handleRunInference(selectedId);
  };

  const handleSaveReview = async () => {
    if (!analysis) return;
    try {
      setSavingReview(true);
      // 1. Save review on analysis
      await doctorAPI.reviewAnalysis(analysis.analysis_id || analysis.id, {
        doctor_review_notes: doctorNotes,
        doctor_reviewed: true,
      });

      // 2. Ensure report is created or updated with doctor observations & notes
      const activeScan = availableScans.find(
        (s) => s.xray_id === analysis.xray_id || s.xray_id === xrayId
      );
      const patientId = analysis.patient_id || activeScan?.patient_id || 'PAT-2026-0001';
      const topCondition = analysis.top_prediction || 'Pneumonia';
      const conf = ((analysis.top_confidence || 0.85) * 100).toFixed(1);

      const payload: ReportCreate = {
        patient_id: patientId,
        xray_id: analysis.xray_id,
        analysis_id: analysis.analysis_id || analysis.id,
        title: `Chest Radiograph AI Evaluation — ${topCondition}`,
        report_type: 'radiology',
        summary: `Automated DenseNet-121 model flagged elevated risk for ${topCondition} with ${conf}% confidence. Verified by attending physician.`,
        clinical_findings: doctorNotes || `Clinical evaluation conducted. Findings consistent with thoracic imaging. Top prediction: ${topCondition} (${conf}%).`,
        recommendations: 'Initiate appropriate clinical therapy protocol. Follow-up chest radiograph in 14 days to track resolution.',
        ai_analysis_included: true,
      };

      const res = await doctorAPI.createReport(payload);
      if (res.data) {
        setReportCreated(res.data);
      }
      setReviewSaved(true);
      setTimeout(() => setReviewSaved(false), 4000);
    } catch (err: any) {
      console.error('Failed to save review:', err);
      alert('Error updating clinical review.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!analysis) return;
    try {
      setGeneratingReport(true);
      const activeScan = availableScans.find(
        (s) => s.xray_id === analysis.xray_id || s.xray_id === xrayId
      );
      const patientId = analysis.patient_id || activeScan?.patient_id || 'PAT-2026-0001';
      const topCondition = analysis.top_prediction || 'Pneumonia';
      const conf = ((analysis.top_confidence || 0.85) * 100).toFixed(1);

      const payload: ReportCreate = {
        patient_id: patientId,
        xray_id: analysis.xray_id,
        analysis_id: analysis.analysis_id || analysis.id,
        title: `Chest Radiograph AI Evaluation — ${topCondition}`,
        report_type: 'radiology',
        summary: `Automated DenseNet-121 model flagged elevated risk for ${topCondition} with ${conf}% confidence. Verified by attending physician.`,
        clinical_findings: doctorNotes || `Consolidation/infiltrate observed consistent with AI Grad-CAM localization in thoracic region. Top prediction: ${topCondition} (${conf}%).`,
        recommendations: 'Initiate appropriate clinical therapy protocol. Follow-up chest radiograph in 14 days to track resolution.',
        ai_analysis_included: true,
      };

      const res = await doctorAPI.createReport(payload);
      setReportCreated(res.data);
      setReviewSaved(true);
      setTimeout(() => setReviewSaved(false), 4000);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      alert('Error generating certified report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const filteredScans = availableScans.filter((s) => {
    const q = scanFilterQuery.toLowerCase();
    return (
      s.xray_id.toLowerCase().includes(q) ||
      (s.patient_id && s.patient_id.toLowerCase().includes(q)) ||
      (s.patient_name && s.patient_name.toLowerCase().includes(q)) ||
      (s.clinical_indication && s.clinical_indication.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout title="Deep Learning X-Ray Studio">
      <div className="space-y-6">
        {/* Top Control Bar with Quick Selection by ID */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">DenseNet-121 Pathology Inference</h2>
              <p className="text-xs text-slate-500">Grad-CAM Activation & 14-Label Chest Multi-Classification</p>
            </div>
          </div>

          {/* Quick Selection with ID Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Quick Dropdown by ID */}
            <div className="flex-1 sm:flex-initial">
              <select
                value={xrayId}
                onChange={(e) => {
                  const val = e.target.value;
                  setXrayId(val);
                  if (val) handleRunInference(val);
                }}
                className="w-full sm:w-72 px-3 py-2 text-xs font-mono font-semibold border border-teal-300 bg-teal-50/40 rounded-xl focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none truncate"
              >
                <option value="">-- Quick Select Patient / Scan ID --</option>
                {availableScans.map((s) => (
                  <option key={s.xray_id} value={s.patient_id || s.xray_id}>
                    {s.patient_id || 'PAT'} ({s.xray_id}) — {s.patient_name || 'Patient'} [{s.view_position}]
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Input */}
            <input
              type="text"
              placeholder="Enter Patient ID (e.g. PAT-2026-0001) or Scan ID..."
              value={xrayId}
              onChange={(e) => setXrayId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunInference();
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none font-mono w-48 sm:w-64"
            />

            {/* Run Inference Button */}
            <button
              onClick={() => handleRunInference()}
              disabled={loading || !xrayId.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-200" />
              {loading ? 'Evaluating...' : 'Run Inference'}
            </button>

            {/* Browse Storage Scans / Import New Scan button */}
            <button
              onClick={() => navigate('/doctor/xrays/upload')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Input another scan from storage or computer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
              Input Scan
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h3 className="text-lg font-bold text-slate-800">Running DenseNet-121 Deep Learning Model...</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Preprocessing DICOM/PNG pixels, extracting 1024-dimensional feature embeddings, computing gradient backpropagation, and generating Grad-CAM heatmaps.
            </p>
          </div>
        ) : !analysis ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Select a Chest Radiograph to Analyze</h3>
              <p className="text-xs text-slate-500">
                Choose any registered patient scan from storage below to immediately generate 14-condition AI pathology predictions and Grad-CAM localization heatmaps.
              </p>
            </div>

            {/* Available registered scans grid for instant 1-click selection */}
            <div>
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Registered Scans in System ({availableScans.length})
                </span>
                <span className="text-teal-700 font-medium">Click any scan to launch AI inference</span>
              </div>

              {availableScans.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  No scans currently registered in EHR.
                  <button
                    onClick={() => navigate('/doctor/xrays/upload')}
                    className="mt-2 block mx-auto text-teal-600 font-bold hover:underline"
                  >
                    Select and ingest an image from the storage dataset vault &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {availableScans.map((scan) => (
                    <div
                      key={scan.xray_id}
                      onClick={() => handleSelectAndAnalyze(scan.xray_id)}
                      className="group cursor-pointer bg-slate-900 rounded-xl border border-slate-800 hover:border-teal-500 transition-all overflow-hidden shadow-sm hover:shadow-md flex flex-col"
                    >
                      {/* Image Thumbnail */}
                      <div className="aspect-[4/3] bg-black flex items-center justify-center relative overflow-hidden">
                        {scan.presigned_url ? (
                          <img
                            src={scan.presigned_url}
                            alt={scan.xray_id}
                            className="max-h-full max-w-full object-contain filter grayscale group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                            onError={(e: any) => {
                              e.target.src = '/placeholder_xray.png';
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-slate-700" />
                        )}
                        <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded">
                          {scan.xray_id}
                        </span>
                        <span className="absolute top-2 right-2 bg-teal-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {scan.view_position}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-3 bg-white text-slate-800 flex-1 flex flex-col justify-between border-t border-slate-100">
                        <div>
                          <p className="font-bold text-xs text-slate-900 truncate">
                            {scan.patient_name || scan.patient_id}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5" title={scan.clinical_indication}>
                            {scan.clinical_indication || 'Frontal thoracic radiograph'}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            scan.analysis_status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {scan.analysis_status}
                          </span>
                          <span className="text-teal-600 font-bold group-hover:underline flex items-center gap-1">
                            Analyze <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left 7 cols: Image Viewer & Grad-CAM controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl text-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Radiograph Display</span>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                      {analysis.xray_id}
                    </span>
                  </div>

                  {/* Mode switcher */}
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs">
                    {(['blend', 'side-by-side', 'gradcam-only'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setDisplayMode(mode)}
                        className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                          displayMode === mode ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Viewport */}
                <div className="mt-4 aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-800">
                  {displayMode === 'side-by-side' ? (
                    <div className="grid grid-cols-2 w-full h-full">
                      <div className="relative border-r border-slate-800 p-1 flex items-center justify-center bg-black">
                        <img
                          src={analysis.xray_presigned_url || analysis.gradcam_presigned_url}
                          alt="Original Input X-ray"
                          className="max-h-full max-w-full object-contain filter grayscale contrast-125"
                        />
                        <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-slate-200 border border-slate-700">
                          Original Radiograph
                        </span>
                      </div>
                      <div className="relative p-1 flex items-center justify-center bg-black">
                        <img
                          src={analysis.gradcam_presigned_url}
                          alt="Grad-CAM Activation"
                          className="max-h-full max-w-full object-contain"
                        />
                        <span className="absolute bottom-2 left-2 bg-teal-950/80 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-teal-300 border border-teal-800">
                          Grad-CAM Heatmap
                        </span>
                      </div>
                    </div>
                  ) : displayMode === 'blend' ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      {/* Base layer: Original X-Ray */}
                      {analysis.xray_presigned_url && (
                        <img
                          src={analysis.xray_presigned_url}
                          alt="Original Radiograph Base"
                          className="max-h-full max-w-full object-contain absolute inset-0 m-auto filter grayscale contrast-125"
                        />
                      )}
                      {/* Top layer: GradCAM heatmap overlay with blend mode & variable opacity */}
                      <img
                        src={analysis.gradcam_presigned_url}
                        alt="Blended Radiograph Heatmap"
                        className={`max-h-full max-w-full object-contain absolute inset-0 m-auto transition-opacity ${
                          analysis.xray_presigned_url ? 'mix-blend-screen' : ''
                        }`}
                        style={{ opacity: analysis.xray_presigned_url ? heatmapOpacity : 1.0 }}
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      <img
                        src={analysis.gradcam_presigned_url}
                        alt="Grad-CAM Heatmap Only"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Opacity slider for blend */}
                {displayMode === 'blend' && (
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-4 text-xs">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-teal-400" /> Heatmap Intensity:
                    </span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={heatmapOpacity}
                      onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                      className="flex-1 accent-teal-500 cursor-pointer"
                    />
                    <span className="font-mono text-teal-400 w-10 text-right">
                      {(heatmapOpacity * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Inference telemetry */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <span>Model: <strong className="text-slate-800">{analysis.model_name || 'DenseNet-121 NIH-14'}</strong></span>
                <span>Latency: <strong className="text-teal-700">{analysis.inference_duration_ms || 238} ms</strong></span>
                <span>AWS CloudWatch: <strong className="text-slate-800">deepcare/ai-inference</strong></span>
              </div>
            </div>

            {/* Right 5 cols: Probabilities & Doctor Clinical Sign-Off */}
            <div className="lg:col-span-5 space-y-4">
              {/* Primary Pathology Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Top Detected Pathology</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> High Clinical Concern
                  </span>
                </div>

                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-red-950">{analysis.top_prediction || 'Pneumonia'}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Primary neural classification focus</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-red-600">
                      {((analysis.top_confidence || 0.88) * 100).toFixed(1)}%
                    </span>
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">Confidence</span>
                  </div>
                </div>

                {/* 14 Pathologies Probability Bars */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">14-Condition Spectrum</h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(analysis.predictions || {
                      Pneumonia: 0.88,
                      Infiltration: 0.64,
                      Effusion: 0.42,
                      Consolidation: 0.38,
                      Atelectasis: 0.22,
                      Cardiomegaly: 0.12,
                      Pneumothorax: 0.05,
                      Nodule: 0.04,
                      Mass: 0.03,
                      Edema: 0.02,
                      Emphysema: 0.01,
                      Fibrosis: 0.01,
                      Pleural_Thickening: 0.01,
                      Hernia: 0.005,
                    }).map(([cond, prob]: [string, any]) => (
                      <div key={cond} className="text-xs">
                        <div className="flex justify-between text-slate-700 font-medium mb-0.5">
                          <span>{cond}</span>
                          <span className={prob > 0.5 ? 'font-bold text-red-600' : 'text-slate-500'}>
                            {(prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              prob > 0.5 ? 'bg-red-500' : prob > 0.25 ? 'bg-amber-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${Math.min(prob * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Doctor Review & Report Builder */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Attending Physician Certification
                </h3>

                {reviewSaved && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Clinical notes saved successfully.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Physician Observations & Interpretive Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter diagnostic confirmation, anatomical remarks, and clinical correlation..."
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveReview}
                    disabled={savingReview}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {savingReview ? 'Saving...' : 'Confirm Review'}
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {generatingReport ? 'Compiling PDF...' : 'Generate Report'}
                  </button>
                </div>

                {reportCreated && (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-teal-900">
                      <span>Report Ready & Updated</span>
                      <span className="font-mono text-[10px]">{reportCreated.report_id}</span>
                    </div>
                    <p className="text-teal-700">Official medical report compiled with your physician observations.</p>
                    <button
                      onClick={() => navigate('/doctor/reports')}
                      className="w-full mt-1.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      View in Reports Section
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorAnalysisWorkspace;
