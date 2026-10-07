import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { patientAPI, XrayImage } from '../../services/api';
import {
  Image, Activity, Calendar, Download, Eye, FileText,
  AlertCircle, CheckCircle2, Clock, Sparkles, Filter
} from 'lucide-react';

const PatientXrays: React.FC = () => {
  const [xrays, setXrays] = useState<XrayImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedXray, setSelectedXray] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    loadXrays();
  }, []);

  const loadXrays = async () => {
    try {
      setLoading(true);
      const res = await patientAPI.getXrays(1);
      setXrays(res.data.items || res.data || []);
    } catch (err) {
      console.error('Error fetching X-rays:', err);
    } finally {
      setLoading(false);
    }
  };

  const openXrayDetails = async (xray: XrayImage) => {
    try {
      setViewLoading(true);
      const res = await patientAPI.getXrayViewUrl(xray.id || xray.xray_id);
      setSelectedXray(res.data);
    } catch (err) {
      console.error('Error fetching X-ray view URL:', err);
      setSelectedXray(xray);
    } finally {
      setViewLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> AI Analyzed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="My Chest X-Rays">
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-teal-200" />
              Medical Imaging Vault
            </h2>
            <p className="text-teal-100 mt-1 max-w-xl text-sm">
              Securely stored in encrypted Amazon S3 with deep learning-powered pathology detection and Grad-CAM interpretability.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-sm font-medium">
            Total Scans: <span className="font-bold text-white text-base">{xrays.length}</span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse h-64"></div>
            ))}
          </div>
        ) : xrays.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Image className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No X-Ray Scans Uploaded Yet</h3>
            <p className="text-slate-500 text-sm mt-1">
              Your attending physician or radiology center will upload your chest scans here. You will receive an instant notification once an AI analysis is ready.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {xrays.map((xray) => (
              <div
                key={xray.id || xray.xray_id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                      ID: {xray.xray_id || xray.id}
                    </span>
                    {getStatusBadge(xray.analysis_status)}
                  </div>

                  <div className="aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden relative flex items-center justify-center mb-4 group-hover:ring-2 ring-teal-500 transition-all">
                    {xray.presigned_url ? (
                      <img
                        src={xray.presigned_url}
                        alt="Chest X-Ray"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                        <span className="text-xs text-slate-400">Encrypted in AWS S3</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Projection:</span>
                      <span className="font-semibold text-slate-800">{xray.view_position || 'PA (Posteroanterior)'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Body Part:</span>
                      <span className="font-semibold text-slate-800">{xray.body_part || 'Chest'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Uploaded On:</span>
                      <span className="text-slate-700">{new Date(xray.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => openXrayDetails(xray)}
                    className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Analysis
                  </button>
                  {xray.presigned_url && (
                    <a
                      href={xray.presigned_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-600 hover:bg-white transition-colors"
                      title="Download Image"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Viewer */}
        {selectedXray && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600" />
                    DeepCare AI Diagnostic Insights
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">X-Ray ID: {selectedXray.xray_id || selectedXray.id}</p>
                </div>
                <button
                  onClick={() => setSelectedXray(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Original Scan */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Radiograph Image</span>
                    <div className="aspect-square bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                      {selectedXray.presigned_url ? (
                        <img
                          src={selectedXray.presigned_url}
                          alt="Chest X-Ray"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-sm text-slate-400">Image Preview Unavailable</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Grad-CAM or AI Findings */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-teal-600 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> DenseNet-121 Grad-CAM Heatmap
                    </span>
                    <div className="aspect-square bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                      {selectedXray.analyses?.[0]?.gradcam_presigned_url || selectedXray.gradcam_presigned_url ? (
                        <img
                          src={selectedXray.analyses?.[0]?.gradcam_presigned_url || selectedXray.gradcam_presigned_url}
                          alt="Grad-CAM Visualization"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-sm">
                          <Activity className="w-8 h-8 text-teal-500 mx-auto mb-2 opacity-50" />
                          <span>Grad-CAM visual explanation generated during deep learning inference</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Probability breakdown */}
                {selectedXray.analyses?.[0] && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-sm mb-3">Predicted Pathology Probabilities</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(selectedXray.analyses[0].predictions || {}).map(([condition, prob]: [string, any]) => (
                        <div key={condition} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                          <div className="flex justify-between font-medium mb-1">
                            <span className="text-slate-700">{condition}</span>
                            <span className={`font-bold ${prob > 0.5 ? 'text-red-600' : 'text-slate-600'}`}>
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${prob > 0.5 ? 'bg-red-500' : 'bg-teal-500'}`}
                              style={{ width: `${Math.min(prob * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedXray(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold"
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

export default PatientXrays;
