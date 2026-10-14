import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  FileCheck,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  Users,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { StatusBadge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Skeleton } from '../design-system/Skeleton';
import './DashboardPage.css';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: drives = [], isLoading: drivesLoading } = useQuery({
    queryKey: ['drives'],
    queryFn: () => apiClient<any[]>('/api/v1/ui/drives')
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => apiClient<any[]>('/api/v1/ui/applications')
  });

  const activeDrives = drives.filter((d) => d.state === 'OPEN');
  const placedApps = applications.filter((a) => a.state === 'OFFER_ISSUED');
  const inProgressApps = applications.filter(
    (a) => !['OFFER_ISSUED', 'NOT_ELIGIBLE', 'WITHDRAWN', 'EXPIRED'].includes(a.state)
  );

  return (
    <div className="apni-dashboard">
      {/* Welcome Banner */}
      <div className="apni-welcome-banner glass-panel">
        <div className="apni-welcome-content">
          <div className="apni-welcome-badge">
            <Sparkles size={14} className="apni-welcome-badge__icon" />
            <span>Campus Placement Portal • 2026 Season</span>
          </div>
          <h2 className="apni-welcome-title">
            Welcome back, {user?.name || user?.user_id}
          </h2>
          <p className="apni-welcome-desc">
            {user?.role === 'Student'
              ? 'Browse open recruitment drives, track your application pipeline, and manage interview slot locks in real time.'
              : user?.role === 'Faculty_TPO'
              ? 'Monitor departmental placement velocity, shortlist criteria, and review candidate progress across campus cohorts.'
              : 'Complete placement administrative control: rule engine weights, slot scheduling, WAL recovery verification, and seat accounting.'}
          </p>
        </div>
        <div className="apni-welcome-action">
          <NavLink to="/drives">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={16} />}>
              Explore Drives
            </Button>
          </NavLink>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="apni-kpi-grid">
        <div className="apni-kpi-card glass-panel">
          <div className="apni-kpi-card__header">
            <span className="apni-kpi-card__title">ACTIVE RECRUITMENT DRIVES</span>
            <div className="apni-kpi-card__icon primary">
              <Briefcase size={20} />
            </div>
          </div>
          <div className="apni-kpi-card__body">
            {drivesLoading ? (
              <Skeleton width="60px" height="32px" />
            ) : (
              <span className="apni-kpi-card__value">{activeDrives.length}</span>
            )}
            <span className="apni-kpi-card__sub">{drives.length} total drives configured</span>
          </div>
        </div>

        <div className="apni-kpi-card glass-panel">
          <div className="apni-kpi-card__header">
            <span className="apni-kpi-card__title">
              {user?.role === 'Student' ? 'MY ACTIVE APPLICATIONS' : 'TOTAL APPLICATIONS'}
            </span>
            <div className="apni-kpi-card__icon info">
              <FileCheck size={20} />
            </div>
          </div>
          <div className="apni-kpi-card__body">
            {appsLoading ? (
              <Skeleton width="60px" height="32px" />
            ) : (
              <span className="apni-kpi-card__value">{applications.length}</span>
            )}
            <span className="apni-kpi-card__sub">{inProgressApps.length} in active review</span>
          </div>
        </div>

        <div className="apni-kpi-card glass-panel">
          <div className="apni-kpi-card__header">
            <span className="apni-kpi-card__title">OFFERS COMMITTED</span>
            <div className="apni-kpi-card__icon success">
              <Award size={20} />
            </div>
          </div>
          <div className="apni-kpi-card__body">
            {appsLoading ? (
              <Skeleton width="60px" height="32px" />
            ) : (
              <span className="apni-kpi-card__value">{placedApps.length}</span>
            )}
            <span className="apni-kpi-card__sub">Atomically committed via 2PL DBMS</span>
          </div>
        </div>

        <div className="apni-kpi-card glass-panel">
          <div className="apni-kpi-card__header">
            <span className="apni-kpi-card__title">PLACEMENT VELOCITY</span>
            <div className="apni-kpi-card__icon warning">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="apni-kpi-card__body">
            {appsLoading ? (
              <Skeleton width="60px" height="32px" />
            ) : (
              <span className="apni-kpi-card__value">
                {applications.length > 0
                  ? `${Math.round((placedApps.length / applications.length) * 100)}%`
                  : '85%'}
              </span>
            )}
            <span className="apni-kpi-card__sub">Across all cohort branches</span>
          </div>
        </div>
      </div>

      {/* Recent Drives and Pipelines */}
      <div className="apni-dashboard-grid">
        <div className="apni-dashboard-panel glass-panel">
          <div className="apni-panel-header">
            <div>
              <h3 className="apni-panel-title">Featured Placement Drives</h3>
              <p className="apni-panel-subtitle">Current recruitment openings with automated rule screening</p>
            </div>
            <NavLink to="/drives" className="apni-panel-link">
              View all <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="apni-panel-list">
            {drivesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton height="60px" />
                <Skeleton height="60px" />
                <Skeleton height="60px" />
              </div>
            ) : drives.slice(0, 4).map((drive: any) => (
              <div key={drive.drive_id} className="apni-drive-item">
                <div className="apni-drive-item__main">
                  <div className="apni-drive-item__badge">{drive.company?.charAt(0) || 'C'}</div>
                  <div>
                    <h4 className="apni-drive-item__company">{drive.company}</h4>
                    <span className="apni-drive-item__criteria">
                      Min CGPA: {drive.criteria?.min_cgpa ?? '7.0'} • Seats: {drive.seats ?? 5}
                    </span>
                  </div>
                </div>
                <div className="apni-drive-item__meta">
                  <span className="apni-drive-item__package">{drive.package || '12 LPA'}</span>
                  <StatusBadge status={drive.state || 'OPEN'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="apni-dashboard-panel glass-panel">
          <div className="apni-panel-header">
            <div>
              <h3 className="apni-panel-title">Application Status Pipeline</h3>
              <p className="apni-panel-subtitle">Authoritative state transitions with Team A locks</p>
            </div>
            <NavLink to="/applications" className="apni-panel-link">
              View tracking <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="apni-panel-list">
            {appsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton height="60px" />
                <Skeleton height="60px" />
              </div>
            ) : applications.length === 0 ? (
              <div className="apni-empty-mini">
                <p>No active applications yet.</p>
                <NavLink to="/drives">
                  <Button variant="outline" size="sm">Browse Drives to Apply</Button>
                </NavLink>
              </div>
            ) : applications.slice(0, 4).map((app: any) => (
              <div key={app.application_id} className="apni-app-item">
                <div className="apni-app-item__main">
                  <div className="apni-app-item__id">
                    <span>App ID: {app.application_id?.substring(0, 8)}...</span>
                    <span className="apni-app-item__student">Candidate: {app.student_id}</span>
                  </div>
                </div>
                <div className="apni-app-item__meta">
                  <StatusBadge status={app.state || 'APPLIED'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
