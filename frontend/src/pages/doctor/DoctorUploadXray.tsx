import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI } from '../../services/api';
import {
  Upload, Image, AlertCircle, CheckCircle2,
  Sparkles, FileText, ArrowRight, ShieldCheck
} from 'lucide-react';

const DoctorUploadXray: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPatientId = (location.state as any)?.patientId || '';

  const [patientId, setPatientId] = useState(initialPatientId);
  const [viewPosition, setViewPosition] = useState('PA');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a chest X-ray image (DICOM / PNG / JPEG).');
      return;
    }
    if (!patientId.trim()) {
      setError('Please provide a valid Patient ID.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('patient_id', patientId.trim());
      formData.append('view_position', viewPosition);
      formData.append('clinical_indication', clinicalIndication);

      const res = await doctorAPI.uploadXray(formData);
      setUploadSuccess(res.data);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err?.response?.data?.detail || 'Failed to upload radiograph to AWS S3.');
    } finally {
      setUploading(false);
    }
  };

  const triggerInferenceNow = async () => {
    if (!uploadSuccess?.xray_id && !uploadSuccess?.id) return;
    const targetId = uploadSuccess.xray_id || uploadSuccess.id;
    try {
      setUploading(true);
      await doctorAPI.requestAnalysis(targetId);
      navigate('/doctor/analyses', { state: { xrayId: targetId } });
    } catch (err: any) {
      console.error('Inference trigger failed:', err);
      navigate('/doctor/analyses', { state: { xrayId: targetId } });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout title="Upload Radiograph Scan">
      <div className="max-w-3xl space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-700 to-cyan-800 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-300" />
              AWS S3 Secure Medical Image Ingestion
            </h2>
            <p className="text-teal-100 text-xs mt-1">
              Encrypted with AES-256 server-side encryption and registered into DeepCare AI diagnostic queue.
            </p>
          </div>
          <ShieldCheck className="w-10 h-10 text-teal-200/50 hidden sm:block" />
        </div>

        {uploadSuccess ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-4 shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Radiograph Uploaded Successfully!</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              X-Ray ID <span className="font-mono font-bold text-teal-700">{uploadSuccess.xray_id || uploadSuccess.id}</span> has been stored in AWS S3 and is ready for DenseNet-121 neural evaluation.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={triggerInferenceNow}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Sparkles className="w-4 h-4 text-teal-200" />
                Launch Deep Learning AI Analysis Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setUploadSuccess(null);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                Upload Another Scan
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Patient DeepCare ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAT-2026-0001"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Radiograph Projection *
                </label>
                <select
                  value={viewPosition}
                  onChange={(e) => setViewPosition(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  <option value="PA">PA (Posteroanterior - Standard Standing)</option>
                  <option value="AP">AP (Anteroposterior - Bedside / Supine)</option>
                  <option value="Lateral">Lateral (Side View)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Clinical Indication / Symptoms
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Patient presents with persistent cough, mild fever, chest pain upon inhalation..."
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
              />
            </div>

            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Chest X-Ray Image (DICOM / PNG / JPEG) *
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center transition-colors cursor-pointer bg-slate-50 hover:bg-teal-50/20 relative">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, .dcm"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {previewUrl ? (
                  <div className="space-y-3">
                    <img
                      src={previewUrl}
                      alt="Scan Preview"
                      className="max-h-60 mx-auto rounded-lg shadow-sm object-contain"
                    />
                    <p className="text-xs text-teal-700 font-semibold">
                      {selectedFile?.name} ({(selectedFile!.size / (1024 * 1024)).toFixed(2)} MB) — Click or drop to change
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto text-teal-600">
                      <Image className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Click to upload or drag & drop</p>
                    <p className="text-xs text-slate-400">Supported formats: PNG, JPEG, DICOM (max 20MB)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Encrypting & Uploading to S3...' : 'Upload Radiograph'}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorUploadXray;
