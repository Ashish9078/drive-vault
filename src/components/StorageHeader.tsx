'use client';

import React from 'react';
import Link from 'next/link';
import {
  HardDrive,
  Cloud,
  Zap,
  LogOut,
  User as UserIcon,
  LogIn,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface StorageHeaderProps {
  totalPool: number;
  totalUsed: number;
  accountCount: number;
  user?: UserProfile | null;
  onLogout?: () => void;
}

export default function StorageHeader({
  totalPool,
  totalUsed,
  accountCount,
  user,
  onLogout,
}: StorageHeaderProps) {
  const totalFree = totalPool - totalUsed;
  const percentUsed = totalPool > 0 ? (totalUsed / totalPool) * 100 : 0;
  const percentFree = 100 - percentUsed;

  const getGradient = () => {
    if (percentUsed < 50) return 'from-emerald-500 to-cyan-500';
    if (percentUsed < 75) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className="storage-header">
      <div className="storage-header-inner">
        <div className="storage-header-grid">
          {/* Left: Title & info */}
          <div className="storage-header-left">
            <div className="storage-header-logo">
              <div className="storage-logo-icon">
                <Cloud size={28} />
              </div>
              <div>
                <h1 className="storage-logo-title">DriveVault</h1>
                <p className="storage-logo-subtitle">Unified Cloud Storage Aggregator</p>
              </div>
            </div>

            <div className="storage-stats-row">
              <div className="storage-stat-chip">
                <HardDrive size={14} />
                <span>{accountCount} {accountCount === 1 ? 'Drive' : 'Drives'} Connected</span>
              </div>
              <div className="storage-stat-chip">
                <Zap size={14} />
                <span>{formatBytes(totalFree)} Free</span>
              </div>

              {/* User Profile or Login Link */}
              {user ? (
                <div className="header-user-badge">
                  <div className="header-user-avatar">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <span className="header-user-name" title={user.email}>
                    {user.name || user.email.split('@')[0]}
                  </span>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="header-logout-btn"
                      title="Sign Out"
                    >
                      <LogOut size={13} />
                      <span>Logout</span>
                    </button>
                  )}
                </div>
              ) : (
                <Link href="/login" className="header-login-btn">
                  <LogIn size={13} />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>

          {/* Right: Storage meter */}
          <div className="storage-header-right">
            <div className="storage-meter-labels">
              <span className="storage-meter-used">
                {formatBytes(totalUsed)} Used
              </span>
              <span className="storage-meter-total">
                / {formatBytes(totalPool)}
              </span>
            </div>

            <div className="storage-meter-bar-track">
              <div
                className={`storage-meter-bar-fill bg-gradient-to-r ${getGradient()}`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
              {/* Segment markers */}
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="storage-meter-segment"
                  style={{ left: `${(i + 1) * 10}%` }}
                />
              ))}
            </div>

            <div className="storage-meter-footer">
              <span>{percentUsed.toFixed(1)}% used</span>
              <span>{percentFree.toFixed(1)}% available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
