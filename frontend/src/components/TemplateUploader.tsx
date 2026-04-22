import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, X, File as FileIcon } from 'lucide-react';

export default function TemplateUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      setUploadStatus('error');
      setErrorMessage('Please upload a valid CSV or Excel file.');
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(file);
    setUploadStatus('idle');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus('uploading');
    
    // Simulate upload delay for now, to be wired up to actual backend endpoint
    setTimeout(() => {
      setUploadStatus('success');
      setTimeout(() => {
        setUploadStatus('idle');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
    }, 1500);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 shadow-xl">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Ingest DORA Templates</h3>
        <p className="text-slate-400 text-sm">
          Upload bulk data via EBA ITS structured templates (RT.01 - RT.09). Supports .csv, .xls, and .xlsx formats.
        </p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out flex flex-col items-center justify-center text-center ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : selectedFile 
              ? 'border-emerald-500/50 bg-emerald-500/5' 
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          className="hidden"
          id="file-upload"
        />

        {!selectedFile ? (
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700 shadow-sm">
              <UploadCloud className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-slate-200 font-medium mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-slate-500 text-sm">
              CSV or Excel files up to 50MB
            </p>
          </label>
        ) : (
          <div className="flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-900/30 flex items-center justify-center mb-4 border border-emerald-500/30">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-emerald-100 font-medium truncate max-w-[200px]">{selectedFile.name}</span>
              <span className="text-emerald-500/70 text-sm">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button 
                onClick={clearSelection}
                className="text-slate-400 hover:text-red-400 transition-colors ml-2"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {uploadStatus === 'idle' && (
              <button 
                onClick={handleUpload}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
              >
                Start Ingestion
              </button>
            )}
            
            {uploadStatus === 'uploading' && (
              <div className="flex items-center gap-3 text-indigo-300">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium animate-pulse">Processing Template...</span>
              </div>
            )}
            
            {uploadStatus === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 font-medium bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Ingestion Completed Successfully
              </div>
            )}
          </div>
        )}
      </div>

      {uploadStatus === 'error' && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Upload Failed</p>
            <p className="text-sm text-red-200/80 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
