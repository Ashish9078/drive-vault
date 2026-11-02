'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Music,
  Video,
  Image as ImageIcon,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FileQuestion,
  RefreshCw
} from 'lucide-react';

interface FilePreviewProps {
  file: {
    id: string;
    filename: string;
    sizeBytes: string;
    mimeType: string;
    driveAccount?: { email: string; displayName?: string } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (fileId: string, filename: string) => void;
}

export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
      setIsFullscreen(false);
      return;
    }

    const isTextOrCode =
      file.mimeType.startsWith('text/') ||
      file.mimeType.includes('json') ||
      file.mimeType.includes('javascript') ||
      file.mimeType.includes('typescript') ||
      file.mimeType.includes('xml') ||
      file.filename.match(/\.(txt|md|json|js|ts|tsx|jsx|css|html|py|sql|csv|env|log|yaml|yml)$/i);

    if (isTextOrCode) {
      setLoadingText(true);
      fetch(`/api/download?fileId=${file.id}&inline=true`)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text);
          setLoadingText(false);
        })
        .catch((err) => {
          console.error('Failed to load text preview:', err);
          setTextContent('Failed to load file preview.');
          setLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const previewUrl = `/api/download?fileId=${file.id}&inline=true`;
  const mime = file.mimeType.toLowerCase();
  const ext = file.filename.split('.').pop()?.toLowerCase() || '';

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const isText =
    mime.startsWith('text/') ||
    ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'py', 'sql', 'csv', 'env', 'log', 'yaml', 'yml'].includes(ext);

  const formatSize = (bytesStr: string) => {
    const bytes = Number(bytesStr);
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative w-full flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-screen h-screen rounded-none' : 'max-w-4xl max-h-[88vh] h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 select-none">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {isImage && <ImageIcon size={20} />}
              {isVideo && <Video size={20} />}
              {isAudio && <Music size={20} />}
              {isPdf && <FileText size={20} className="text-red-400" />}
              {isText && <FileText size={20} className="text-emerald-400" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isText && <FileQuestion size={20} />}
            </div>
            <div className="truncate">
              <h3 className="text-base font-semibold text-slate-100 truncate">{file.filename}</h3>
              <p className="text-xs text-slate-400">
                {formatSize(file.sizeBytes)} • {file.driveAccount?.displayName || file.driveAccount?.email || 'Unified Drive Pool'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownload(file.id, file.filename)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
              title="Download file"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </button>

            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              title="Open raw in new tab"
            >
              <ExternalLink size={16} />
            </a>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors hidden sm:block"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center relative p-2">
          {/* 1. Image Preview */}
          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={file.filename}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
              />
            </div>
          )}

          {/* 2. Video Preview */}
          {isVideo && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <video
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg shadow-xl bg-black"
                src={previewUrl}
              >
                Your browser does not support playing this video.
              </video>
            </div>
          )}

          {/* 3. Audio Preview */}
          {isAudio && (
            <div className="flex flex-col items-center justify-center space-y-6 p-8 max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 animate-pulse">
                <Music size={44} />
              </div>
              <div className="text-center w-full">
                <h4 className="text-sm font-semibold text-slate-100 truncate">{file.filename}</h4>
                <p className="text-xs text-slate-400 mt-1">{formatSize(file.sizeBytes)}</p>
              </div>
              <audio controls autoPlay className="w-full" src={previewUrl}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* 4. PDF Preview */}
          {isPdf && (
            <iframe
              src={previewUrl}
              title={file.filename}
              className="w-full h-full rounded-md border-0 bg-slate-900"
            />
          )}

          {/* 5. Text / Code Preview */}
          {isText && (
            <div className="w-full h-full flex flex-col p-2">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 rounded-t-lg border-b border-slate-800 text-xs text-slate-400">
                <span>File Text Preview</span>
                <button
                  onClick={copyText}
                  className="flex items-center space-x-1 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-slate-900/40 p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                {loadingText ? (
                  <div className="flex items-center justify-center h-full space-x-2 text-slate-400">
                    <RefreshCw size={18} className="animate-spin text-blue-400" />
                    <span>Loading text content...</span>
                  </div>
                ) : (
                  textContent || 'No preview available.'
                )}
              </div>
            </div>
          )}

          {/* 6. Unsupported / Binary Preview Fallback */}
          {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
            <div className="text-center p-8 max-w-sm space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <FileQuestion size={40} />
              </div>
              <div>
                <h4 className="text-base font-medium text-slate-200">No Direct Preview</h4>
                <p className="text-xs text-slate-400 mt-1">
                  This file format ({ext.toUpperCase() || 'Binary'}) cannot be rendered directly in the browser preview.
                </p>
              </div>
              <button
                onClick={() => onDownload(file.id, file.filename)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                <Download size={16} />
                <span>Download to View</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

