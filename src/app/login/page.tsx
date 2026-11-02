'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Cloud,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Sparkles,
  AlertCircle,
  Loader2,
  HardDrive,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setError('');
    setLoading(true);

    try {
      // First try to login demo user
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@drivevault.io', password: 'password123' }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
        return;
      }

      // If demo user does not exist, auto-register
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@drivevault.io',
          password: 'password123',
          name: 'Ashish Admin',
        }),
      });

      if (regRes.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await regRes.json();
        throw new Error(data.error || 'Demo login failed');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Demo sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background cyber orbs */}
      <div className="dashboard-bg">
        <div className="dashboard-bg-orb dashboard-bg-orb-1" />
        <div className="dashboard-bg-orb dashboard-bg-orb-2" />
        <div className="dashboard-bg-orb dashboard-bg-orb-3" />
      </div>

      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-badge">
            <Cloud size={32} className="auth-logo-icon" />
            <span className="auth-shield-dot">
              <Shield size={12} />
            </span>
          </div>
          <h1 className="auth-title">DriveVault</h1>
          <p className="auth-subtitle">150GB Unified Cloud Storage Pool</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Welcome Back</h2>
            <p className="auth-card-desc">Sign in to access your unified Google Drive pool</p>
          </div>

          {error && (
            <div className="auth-alert error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Email Field */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                Email Address
              </label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <div className="flex justify-between items-center">
                <label className="auth-label" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Button */}
          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="auth-demo-btn"
          >
            <Sparkles size={16} />
            <span>Instant 1-Click Demo Login</span>
          </button>

          {/* Footer Link */}
          <div className="auth-footer">
            <span>Don&apos;t have an account?</span>
            <Link href="/register" className="auth-footer-link">
              Create an account
            </Link>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="auth-features">
          <div className="auth-feature-chip">
            <HardDrive size={13} />
            <span>Unlimited Google Drives</span>
          </div>
          <div className="auth-feature-chip">
            <Shield size={13} />
            <span>AES-256 Encrypted</span>
          </div>
          <div className="auth-feature-chip">
            <Cloud size={13} />
            <span>Multi-TB Virtual Pool</span>
          </div>
        </div>
      </div>
    </div>
  );
}
