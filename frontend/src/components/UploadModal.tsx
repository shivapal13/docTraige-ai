import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { documentsApi } from '../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (f: File) => {
    setError(null);
    setSuccess(false);
    if (f.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit.'); return; }
    const valid = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.docx', '.txt'];
    if (!valid.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      setError('Unsupported file type. PDF, DOCX, TXT, or image files only.');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await documentsApi.upload(file);
      setSuccess(true);
      setTimeout(() => { onUploadSuccess(); handleClose(); }, 900);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null); setError(null); setSuccess(false); setUploading(false); onClose();
  };

  const fmtSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md bg-[#171b26] rounded-xl border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Upload Document</h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-200 p-1 rounded transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">
            Upload a clinical record for OCR, lab extraction, and automatic urgency triage.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Queued for processing.</span>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
              dragActive
                ? 'border-red-500 bg-red-500/5'
                : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/20'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.docx,.txt"
              onChange={handleChange}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Drop file here or <span className="text-red-400">browse</span></p>
            <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT, TIFF, PNG — max 20 MB</p>
          </div>

          {/* Selected file */}
          {file && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-sm">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-slate-200 truncate">{file.name}</div>
                <div className="text-xs text-slate-500">{fmtSize(file.size)}</div>
              </div>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading || success}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
