'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileUp,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  FolderPlus,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  return formatBytes(bytesPerSecond) + '/s';
}

interface UploadZoneProps {
  onUploadComplete: () => void;
  currentFolder?: string;
}

interface UploadState {
  file: File | null;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  progress: number;
  speed: number;
  error: string | null;
  uploadId: string | null;
}

const PRESET_FOLDERS = [
  '/',
  '/Documents',
  '/Development',
  '/Videos',
  '/Backups',
  '/Photography',
  '/Audio',
  '/AI-Models',
];

export default function UploadZone({ onUploadComplete, currentFolder = '/' }: UploadZoneProps) {
  const [upload, setUpload] = useState<UploadState>({
    file: null,
    status: 'idle',
    progress: 0,
    speed: 0,
    error: null,
    uploadId: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(currentFolder === 'ALL' ? '/' : currentFolder);
  const [customFolder, setCustomFolder] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentFolder && currentFolder !== 'ALL') {
      setSelectedFolder(currentFolder);
    }
  }, [currentFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      startUpload(files[0]);
    }
  }, [selectedFolder, customFolder, showCustomInput]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      startUpload(files[0]);
    }
  }, [selectedFolder, customFolder, showCustomInput]);

  const startUpload = async (file: File) => {
    const finalFolder = showCustomInput && customFolder.trim()
      ? (customFolder.startsWith('/') ? customFolder.trim() : '/' + customFolder.trim())
      : selectedFolder;

    setUpload({
      file,
      status: 'uploading',
      progress: 0,
      speed: 0,
      error: null,
      uploadId: null,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('virtualPath', finalFolder);

      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? Math.round(e.loaded / elapsed) : 0;

          setUpload(prev => ({
            ...prev,
            progress,
            speed,
          }));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUpload(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            uploadId: response.uploadId,
          }));
          onUploadComplete();
        } else {
          const errorMsg = (() => {
            try { return JSON.parse(xhr.responseText).error; } catch { return 'Upload failed'; }
          })();
          setUpload(prev => ({
            ...prev,
            status: 'error',
            error: errorMsg,
          }));
        }
      });

      xhr.addEventListener('error', () => {
        setUpload(prev => ({
          ...prev,
          status: 'error',
          error: 'Network error during upload',
        }));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch {
      setUpload(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to initiate upload',
      }));
    }
  };

  const resetUpload = () => {
    setUpload({
      file: null,
      status: 'idle',
      progress: 0,
      speed: 0,
      error: null,
      uploadId: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-zone">
      {/* Target Folder Selector */}
      <div className="upload-folder-bar">
        <div className="upload-folder-label">
          <Folder size={15} className="text-amber-400" />
          <span>Upload into Folder:</span>
        </div>

        <div className="upload-folder-controls">
          <select
            value={showCustomInput ? '__custom__' : selectedFolder}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setShowCustomInput(true);
              } else {
                setShowCustomInput(false);
                setSelectedFolder(e.target.value);
              }
            }}
            className="upload-folder-select"
          >
            {PRESET_FOLDERS.map((folder) => (
              <option key={folder} value={folder}>
                {folder === '/' ? 'Root Directory (/)' : folder}
              </option>
            ))}
            <option value="__custom__">+ Custom Folder...</option>
          </select>

          {showCustomInput && (
            <input
              type="text"
              placeholder="/My-Project-Folder"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              className="upload-custom-folder-input"
            />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload-input"
      />

      {upload.status === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`upload-dropzone ${isDragging ? 'upload-dropzone-active' : ''}`}
        >
          <div className="upload-dropzone-inner">
            <div className="upload-dropzone-icon-wrapper">
              <Upload size={32} className="upload-dropzone-icon" />
            </div>
            <p className="upload-dropzone-text">
              Tap or drop file here to upload, or <span className="upload-dropzone-link">browse files</span>
            </p>
            <p className="upload-dropzone-hint">
              Supports files up to 10GB • Auto-splits across available drives • Saves into{' '}
              <strong className="text-cyan-300 font-mono">
                {showCustomInput && customFolder ? customFolder : selectedFolder}
              </strong>
            </p>
          </div>
        </div>
      )}

      {upload.status !== 'idle' && upload.file && (
        <div className="upload-progress-card">
          <div className="upload-progress-header">
            <div className="upload-progress-file-info">
              <FileUp size={18} className="upload-progress-file-icon" />
              <div>
                <p className="upload-progress-filename">{upload.file.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{formatBytes(upload.file.size)}</span>
                  <span>•</span>
                  <span>Folder: {selectedFolder}</span>
                </div>
              </div>
            </div>

            <button onClick={resetUpload} className="upload-progress-close">
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="upload-progress-bar-container">
            <div className="upload-progress-bar-track">
              <div
                className={`upload-progress-bar-fill ${
                  upload.status === 'completed'
                    ? 'upload-bar-completed'
                    : upload.status === 'error'
                    ? 'upload-bar-error'
                    : 'upload-bar-active'
                }`}
                style={{ width: `${upload.progress}%` }}
              />
            </div>

            <div className="upload-progress-stats">
              <div className="upload-progress-status">
                {upload.status === 'uploading' && (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Uploading... {upload.progress}%</span>
                  </>
                )}
                {upload.status === 'completed' && (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Upload Complete! Saved into {selectedFolder}</span>
                  </>
                )}
                {upload.status === 'error' && (
                  <>
                    <AlertCircle size={14} />
                    <span>{upload.error}</span>
                  </>
                )}
              </div>

              {upload.status === 'uploading' && upload.speed > 0 && (
                <span className="upload-progress-speed">
                  {formatSpeed(upload.speed)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
