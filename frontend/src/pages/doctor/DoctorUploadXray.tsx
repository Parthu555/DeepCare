import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { doctorAPI, StorageDatasetImage } from '../../services/api';
import {
  Upload, Image as ImageIcon, AlertCircle, CheckCircle2,
  Sparkles, FileText, ArrowRight, ShieldCheck, Database,
  Search, Filter, Check, ExternalLink, HardDrive, Eye
} from 'lucide-react';

const DoctorUploadXray: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPatientId = (location.state as any)?.patientId || 'PAT-2026-0001';

  // Ingestion Mode: 'storage' (select from storage dataset) or 'upload' (local computer)
  const [ingestionMode, setIngestionMode] = useState<'storage' | 'upload'>('storage');

  // Common metadata
  const [patientId, setPatientId] = useState(initialPatientId);
  const [viewPosition, setViewPosition] = useState('PA');
  const [clinicalIndication, setClinicalIndication] = useState('');

  // Storage selection states
  const [storageImages, setStorageImages] = useState<StorageDatasetImage[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [selectedStorageId, setSelectedStorageId] = useState<string>('00000001_000.png');
  const [selectedStorageItem, setSelectedStorageItem] = useState<StorageDatasetImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Manual file upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Status & processing
  const [processing, setProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load storage dataset images on mount
  useEffect(() => {
    fetchStorageImages();
  }, []);

  const fetchStorageImages = async () => {
    try {
      setLoadingStorage(true);
      const res = await doctorAPI.getStorageImages();
      setStorageImages(res.data);
      if (res.data && res.data.length > 0) {
        // Pre-select first image if none selected
        const first = res.data[0];
        setSelectedStorageId(first.image_id);
        setSelectedStorageItem(first);
        if (first.patient_id) setPatientId(first.patient_id);
        setViewPosition(first.view_position || 'PA');
        setClinicalIndication(`Evaluation of ${first.finding || 'thoracic pathology'}. Patient ${first.patient_id || 'PAT-2026-0001'}.`);
      }
    } catch (err: any) {
      console.error('Failed to load storage images:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  // Handle selecting an image from the storage gallery or by ID
  const handleSelectStorageImage = (item: StorageDatasetImage) => {
    setSelectedStorageId(item.image_id);
    setSelectedStorageItem(item);
    if (item.patient_id) {
      setPatientId(item.patient_id);
    }
    setViewPosition(item.view_position || 'PA');
    setClinicalIndication(`Chest radiograph evaluation for ${item.finding}. Patient ${item.patient_id || patientId}.`);
    setError(null);
  };

  // Handle direct ID typing or selection
  const handleDirectIdChange = (idValue: string) => {
    setSelectedStorageId(idValue);
    const trimmed = idValue.trim().toLowerCase();
    const matched = storageImages.find(
      (img) =>
        img.image_id.toLowerCase() === trimmed ||
        (img.patient_id && img.patient_id.toLowerCase() === trimmed)
    );
    if (matched) {
      setSelectedStorageItem(matched);
      if (matched.patient_id) setPatientId(matched.patient_id);
      setViewPosition(matched.view_position || 'PA');
      setClinicalIndication(`Chest radiograph evaluation for ${matched.finding}. Patient ${matched.patient_id}.`);
    }
  };

  // Manual file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  // Submit from Storage
  const handleImportFromStorage = async (autoLaunchInference = false) => {
    if (!selectedStorageId) {
      setError('Please select an image ID from the storage repository.');
      return;
    }
    if (!patientId.trim()) {
      setError('Please provide a valid Patient DeepCare ID (e.g. PAT-2026-0001).');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const res = await doctorAPI.importFromStorage({
        image_id: selectedStorageId,
        patient_id: patientId.trim(),
        view_position: viewPosition,
        clinical_indication: clinicalIndication || `Imported ${selectedStorageId} for patient evaluation`,
        body_part: 'Chest',
      });

      const importedScan = res.data;
      setUploadSuccess(importedScan);

      if (autoLaunchInference) {
        const targetId = importedScan.xray_id || importedScan.id;
        try {
          await doctorAPI.requestAnalysis(targetId);
          navigate('/doctor/analyses', { state: { xrayId: targetId } });
        } catch (inferErr) {
          console.error('Inference trigger after import failed:', inferErr);
          navigate('/doctor/analyses', { state: { xrayId: targetId } });
        }
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err?.response?.data?.detail || 'Failed to import image from storage repository.');
    } finally {
      setProcessing(false);
    }
  };

  // Submit manual file upload
  const handleManualUpload = async (e: React.FormEvent) => {
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
      setProcessing(true);
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
      setProcessing(false);
    }
  };

  const triggerInferenceNow = async () => {
    if (!uploadSuccess?.xray_id && !uploadSuccess?.id) return;
    const targetId = uploadSuccess.xray_id || uploadSuccess.id;
    try {
      setProcessing(true);
      await doctorAPI.requestAnalysis(targetId);
      navigate('/doctor/analyses', { state: { xrayId: targetId } });
    } catch (err: any) {
      console.error('Inference trigger failed:', err);
      navigate('/doctor/analyses', { state: { xrayId: targetId } });
    } finally {
      setProcessing(false);
    }
  };

  // Filtered storage images
  const filteredStorageImages = storageImages.filter((img) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      img.image_id.toLowerCase().includes(q) ||
      (img.patient_id && img.patient_id.toLowerCase().includes(q)) ||
      img.finding.toLowerCase().includes(q) ||
      img.view_position.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (categoryFilter === 'All') return true;
    if (categoryFilter === 'Cardiomegaly') return img.finding.toLowerCase().includes('cardiomegaly');
    if (categoryFilter === 'Pneumonia') return img.finding.toLowerCase().includes('pneumonia');
    if (categoryFilter === 'COVID-19') return img.finding.toLowerCase().includes('covid');
    if (categoryFilter === 'Infiltration') return img.finding.toLowerCase().includes('infiltration') || img.finding.toLowerCase().includes('effusion');
    return true;
  });

  return (
    <DashboardLayout title="Input Radiograph Scan">
      <div className="max-w-6xl space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/30 text-teal-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <HardDrive className="w-3.5 h-3.5" /> Medical Imaging Ingestion Engine
            </div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Ingest Radiographs to DeepCare AI Studio
            </h2>
            <p className="text-teal-100 text-xs mt-1 max-w-xl">
              Select directly from pre-loaded NIH ChestXray14 & COVID-19 storage repository by ID, or upload DICOM/PNG files from local storage.
            </p>
          </div>
          <ShieldCheck className="w-12 h-12 text-teal-300/40 hidden md:block" />
        </div>

        {uploadSuccess ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-4 shadow-sm animate-fade-in max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Radiograph Ingested Successfully!</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              X-Ray ID <span className="font-mono font-bold text-teal-700">{uploadSuccess.xray_id || uploadSuccess.id}</span> is linked to patient <span className="font-mono font-bold text-slate-800">{patientId}</span> and registered in AWS S3 storage.
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
                Select Another Image
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto inline-flex">
              <button
                type="button"
                onClick={() => {
                  setIngestionMode('storage');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  ingestionMode === 'storage'
                    ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-4 h-4 text-teal-600" />
                Select from Storage / Real Datasets by ID
                <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {storageImages.length} available
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIngestionMode('upload');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  ingestionMode === 'upload'
                    ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Manual File Upload (Local Computer)
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: SELECT FROM STORAGE */}
            {ingestionMode === 'storage' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 8 cols: Storage Dataset Selection Gallery */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Search, Filter & Direct ID input */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {/* Direct ID Selector */}
                      <div className="w-full sm:w-1/2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Direct Selection by Image ID:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. 00000001_000.png"
                            value={selectedStorageId}
                            onChange={(e) => handleDirectIdChange(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-teal-300 rounded-lg text-teal-900 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 outline-none"
                          />
                          <span className="absolute right-2 top-2 text-[10px] bg-teal-100 text-teal-800 font-semibold px-1.5 py-0.5 rounded">
                            ID Active
                          </span>
                        </div>
                      </div>

                      {/* Search Filter */}
                      <div className="w-full sm:w-1/2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Filter by Keyword / Finding:
                        </label>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Search finding, view (PA/AP)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Filters:
                      </span>
                      {['All', 'Cardiomegaly', 'Pneumonia', 'COVID-19', 'Infiltration'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            categoryFilter === cat
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Storage Images Grid */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                      <span>
                        Showing <strong className="text-slate-800">{filteredStorageImages.length}</strong> real chest radiographs in storage
                      </span>
                      <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">
                        Click card or ID to select
                      </span>
                    </div>

                    {loadingStorage ? (
                      <div className="py-16 text-center space-y-3">
                        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-slate-500">Loading radiographs from storage repository...</p>
                      </div>
                    ) : filteredStorageImages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No images found matching "{searchQuery}".
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[520px] overflow-y-auto p-1">
                        {filteredStorageImages.map((img) => {
                          const isSelected = selectedStorageId.toLowerCase() === img.image_id.toLowerCase();
                          return (
                            <div
                              key={img.image_id}
                              onClick={() => handleSelectStorageImage(img)}
                              className={`relative group cursor-pointer rounded-xl border-2 transition-all overflow-hidden flex flex-col bg-slate-900 ${
                                isSelected
                                  ? 'border-teal-500 ring-2 ring-teal-500/30 shadow-md transform scale-[1.02]'
                                  : 'border-slate-200 hover:border-teal-400'
                              }`}
                            >
                              {/* Selected indicator badge */}
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 z-10 bg-teal-500 text-white rounded-full p-1 shadow-md">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              )}

                              {/* Projection Badge */}
                              <div className="absolute top-1.5 left-1.5 z-10 bg-black/70 backdrop-blur-xs text-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {img.view_position}
                              </div>

                              {/* Image Thumbnail */}
                              <div className="aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
                                <img
                                  src={img.preview_url}
                                  alt={img.image_id}
                                  className="h-full w-full object-contain filter grayscale group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                  onError={(e: any) => {
                                    e.target.onerror = null;
                                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2314b8a6' stroke-width='1.5'%3E%3Crect width='18' height='18' x='3' y='3' rx='2'/%3E%3Cpath d='M9 9h6v6H9z'/%3E%3C/svg%3E";
                                  }}
                                />
                              </div>

                              {/* Card Meta */}
                              <div className="p-2 bg-white text-slate-800 flex-1 flex flex-col justify-between border-t border-slate-100">
                                <div>
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="font-mono text-[11px] font-bold truncate text-slate-900" title={img.image_id}>
                                      {img.image_id}
                                    </p>
                                    {img.patient_id && (
                                      <span className="font-mono text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded shrink-0">
                                        {img.patient_id}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-teal-700 font-semibold truncate mt-0.5" title={img.finding}>
                                    {img.finding}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-50">
                                  <span>{img.file_size_kb} KB</span>
                                  <span className={`font-bold ${isSelected ? 'text-teal-600' : 'text-slate-500'}`}>
                                    {isSelected ? 'Selected' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 4 cols: Selected Scan Inspector & Ingestion Actions */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 sticky top-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-teal-600" />
                      Selected Storage Scan
                    </h3>

                    {/* Preview Image Box */}
                    <div className="aspect-[4/3] bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-800">
                      {selectedStorageItem ? (
                        <>
                          <img
                            src={selectedStorageItem.preview_url}
                            alt={selectedStorageItem.image_id}
                            className="max-h-full max-w-full object-contain filter grayscale"
                          />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded text-xs text-white">
                            <span className="font-mono font-bold truncate">{selectedStorageItem.image_id}</span>
                            <span className="text-[10px] bg-teal-600 px-1.5 py-0.5 rounded">{selectedStorageItem.view_position}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-slate-500 p-4">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <p className="text-xs">No image selected</p>
                        </div>
                      )}
                    </div>

                    {/* Storage Metadata Summary */}
                    {selectedStorageItem && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Pathology Finding:</span>
                          <span className="font-semibold text-teal-800 text-right">{selectedStorageItem.finding}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Projection View:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedStorageItem.view_position}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">File Size:</span>
                          <span className="text-slate-600">{selectedStorageItem.file_size_kb} KB</span>
                        </div>
                      </div>
                    )}

                    {/* Ingestion Parameters */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Assign to Patient ID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. PAT-2026-0001"
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Projection View
                        </label>
                        <select
                          value={viewPosition}
                          onChange={(e) => setViewPosition(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                        >
                          <option value="PA">PA (Posteroanterior - Standing)</option>
                          <option value="AP">AP (Anteroposterior - Supine/Bedside)</option>
                          <option value="Lateral">Lateral (Side View)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Clinical Indication / Symptoms
                        </label>
                        <textarea
                          rows={2}
                          value={clinicalIndication}
                          onChange={(e) => setClinicalIndication(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Execution Buttons */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleImportFromStorage(true)}
                        disabled={processing || !selectedStorageId}
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 text-teal-200" />
                        {processing ? 'Importing & Launching AI...' : 'Import & Launch AI Inference'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleImportFromStorage(false)}
                        disabled={processing || !selectedStorageId}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {processing ? 'Processing...' : 'Import to Patient Record Only'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL FILE UPLOAD */}
            {ingestionMode === 'upload' && (
              <form onSubmit={handleManualUpload} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-2xl">
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
                          <ImageIcon className="w-6 h-6" />
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
                    disabled={processing || !selectedFile}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {processing ? 'Encrypting & Uploading to S3...' : 'Upload Radiograph'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorUploadXray;
