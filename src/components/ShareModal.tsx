'use client';

import React, { useState } from 'react';
import {
  X,
  Share2,
  Lock,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Loader2
} from 'lucide-react';

interface ShareModalProps {
  file: {
    id: string;
    filename: string;
    sizeBytes: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const [password, setPassword] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !file) return null;

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          password: password || undefined,
          expiresInHours: expiresInHours === 'never' ? undefined : Number(expiresInHours),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create share link');
      }

      const fullUrl = `${window.location.origin}${data.url}`;
      setCreatedUrl(fullUrl);
    } catch (err: unknown) {
      const errObj = err as Error;
      setError(errObj.message || 'Something went wrong');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = () => {
    if (createdUrl) {
      navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const resetModal = () => {
    setCreatedUrl(null);
    setPassword('');
    setExpiresInHours('24');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Share File</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{file.filename}</p>
            </div>
          </div>
          <button
            onClick={resetModal}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!createdUrl ? (
            <form onSubmit={handleGenerateLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Lock size={13} className="text-slate-400" />
                  <span>Optional Password Protection</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for public access"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Clock size={13} className="text-slate-400" />
                  <span>Link Expiration</span>
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="1">1 Hour</option>
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="72">3 Days</option>
                  <option value="168">7 Days (1 Week)</option>
                  <option value="never">Never (Permanent)</option>
                </select>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 mt-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Generating Link...</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Create Shareable Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
                <Shield size={16} className="shrink-0" />
                <span>Link created successfully! Anyone with this link can download.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Shareable URL:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={createdUrl}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono truncate focus:outline-none select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm shrink-0"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <a
                  href={createdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline flex items-center space-x-1"
                >
                  <ExternalLink size={13} />
                  <span>Open link in new tab</span>
                </a>
                <button
                  onClick={resetModal}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

