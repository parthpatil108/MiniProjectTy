import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Building,
  GraduationCap,
  Users,
  Send,
  Sparkles,
  HelpCircle,
  FileCheck2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { StatusBadge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Modal } from '../design-system/Modal';
import { EmptyState } from '../design-system/EmptyState';
import { TableSkeleton } from '../design-system/Skeleton';
import { useToast } from '../design-system/Toast';
import './DrivesPage.css';

export function DrivesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [minCgpaFilter, setMinCgpaFilter] = useState(0);

  // Modals state
  const [selectedDriveForPreCheck, setSelectedDriveForPreCheck] = useState<any | null>(null);
  const [selectedDriveForApply, setSelectedDriveForApply] = useState<any | null>(null);
  const [resumeVersion, setResumeVersion] = useState('v1.0-standard');
  const [consent, setConsent] = useState(true);

  const { data: drives = [], isLoading, error, refetch } = useQuery({
    queryKey: ['drives'],
    queryFn: () => apiClient<any[]>('/api/v1/ui/drives')
  });

  const { data: myProfile } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => apiClient<any>(`/api/v1/ui/profile`),
    enabled: user?.role === 'Student'
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async ({ driveId, resumeVer }: { driveId: string; resumeVer: string }) => {
      const idempotencyKey = `apply-${user?.user_id}-${driveId}-${Date.now()}`;
      return apiClient<any>('/api/v1/ui/applications', {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify({
          student_id: user?.user_id,
          drive_id: driveId,
          resume_version: resumeVer,
          consent: true
        })
      });
    },
    onSuccess: (data) => {
      addToast({
        type: 'success',
        title: 'Application Submitted!',
        message: `Your application is in state ${data.state || 'APPLIED'}. Queue position: ${data.queue_position || 1}`
      });
      setSelectedDriveForApply(null);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['drives'] });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Application Failed',
        message: err.message || 'Could not submit application.'
      });
    }
  });

  // Filter logic
  const filteredDrives = drives.filter((drive) => {
    const matchesSearch =
      drive.company?.toLowerCase().includes(search.toLowerCase()) ||
      drive.criteria?.required_skill_tags?.some((s: string) =>
        s.toLowerCase().includes(search.toLowerCase())
      );

    const matchesBranch =
      branchFilter === 'ALL' ||
      drive.criteria?.allowed_branches?.includes(branchFilter);

    const matchesCgpa = (drive.criteria?.min_cgpa ?? 0) >= minCgpaFilter;

    return matchesSearch && matchesBranch && matchesCgpa;
  });

  // Pre-check logic for student
  const getPreCheckResult = (drive: any) => {
    if (!myProfile) {
      return { eligible: true, reasons: ['Student profile not loaded; pre-check will occur upon application.'] };
    }
    const reasons: string[] = [];
    let eligible = true;

    if (myProfile.cgpa < (drive.criteria?.min_cgpa ?? 0)) {
      eligible = false;
      reasons.push(`CGPA (${myProfile.cgpa}) is below required cutoff (${drive.criteria?.min_cgpa})`);
    } else {
      reasons.push(`CGPA (${myProfile.cgpa}) satisfies minimum cutoff (${drive.criteria?.min_cgpa})`);
    }

    if (myProfile.backlogs > (drive.criteria?.max_backlogs ?? 0)) {
      eligible = false;
      reasons.push(`Active backlogs (${myProfile.backlogs}) exceed maximum allowed (${drive.criteria?.max_backlogs})`);
    } else {
      reasons.push(`Backlogs (${myProfile.backlogs}) within acceptable limit (<= ${drive.criteria?.max_backlogs})`);
    }

    if (drive.criteria?.allowed_branches?.length > 0 && !drive.criteria.allowed_branches.includes(myProfile.branch)) {
      eligible = false;
      reasons.push(`Branch '${myProfile.branch}' is not in allowed list: ${drive.criteria.allowed_branches.join(', ')}`);
    } else {
      reasons.push(`Branch '${myProfile.branch}' is eligible for this role`);
    }

    return { eligible, reasons };
  };

  return (
    <div className="apni-drives-page">
      {/* Header and Filter Toolbar */}
      <div className="apni-drives-header">
        <div>
          <h2 className="apni-page-title">Placement Drives Explorer</h2>
          <p className="apni-page-subtitle">
            Verified campus hiring drives with automated criteria screening
          </p>
        </div>

        <div className="apni-drives-toolbar">
          <div className="apni-search-box">
            <Search size={16} className="apni-search-box__icon" />
            <input
              type="text"
              placeholder="Search companies or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="apni-search-box__input"
            />
          </div>

          <div className="apni-filter-group">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="apni-select"
              aria-label="Filter by branch"
            >
              <option value="ALL">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drives Cards Grid */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : error ? (
        <EmptyState
          title="Failed to Load Drives"
          description={(error as any)?.message || 'Could not connect to the placement backend.'}
          action={<Button onClick={() => refetch()}>Retry Connection</Button>}
        />
      ) : filteredDrives.length === 0 ? (
        <EmptyState
          title="No Placement Drives Found"
          description="Try broadening your search term or clearing branch filters."
          action={<Button variant="outline" onClick={() => { setSearch(''); setBranchFilter('ALL'); }}>Reset Filters</Button>}
        />
      ) : (
        <div className="apni-drives-grid">
          {filteredDrives.map((drive: any) => (
            <div key={drive.drive_id} className="apni-drive-card glass-panel">
              <div className="apni-drive-card__top">
                <div className="apni-drive-card__company-row">
                  <div className="apni-drive-card__avatar">
                    {drive.company?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h3 className="apni-drive-card__company">{drive.company}</h3>
                    <span className="apni-drive-card__id">ID: {drive.drive_id?.substring(0, 8)}...</span>
                  </div>
                </div>
                <StatusBadge status={drive.state || 'OPEN'} />
              </div>

              <div className="apni-drive-card__specs">
                <div className="apni-spec-item">
                  <span className="apni-spec-item__label">PACKAGE</span>
                  <span className="apni-spec-item__value highlight">{drive.package || '10 LPA'}</span>
                </div>
                <div className="apni-spec-item">
                  <span className="apni-spec-item__label">SEATS</span>
                  <span className="apni-spec-item__value">{drive.seats ?? 5}</span>
                </div>
                <div className="apni-spec-item">
                  <span className="apni-spec-item__label">MIN CGPA</span>
                  <span className="apni-spec-item__value">{drive.criteria?.min_cgpa ?? '7.0'}</span>
                </div>
                <div className="apni-spec-item">
                  <span className="apni-spec-item__label">MAX BACKLOGS</span>
                  <span className="apni-spec-item__value">{drive.criteria?.max_backlogs ?? 0}</span>
                </div>
              </div>

              {drive.criteria?.required_skill_tags && drive.criteria.required_skill_tags.length > 0 && (
                <div className="apni-drive-card__skills">
                  <span className="apni-skills-title">Required Skills:</span>
                  <div className="apni-skills-tags">
                    {drive.criteria.required_skill_tags.map((skill: string) => (
                      <span key={skill} className="apni-skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="apni-drive-card__actions">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<HelpCircle size={14} />}
                  onClick={() => setSelectedDriveForPreCheck(drive)}
                >
                  Eligibility Check
                </Button>

                {user?.role === 'Student' && drive.state === 'OPEN' && (
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<Send size={14} />}
                    onClick={() => setSelectedDriveForApply(drive)}
                  >
                    Apply Now
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Eligibility Pre-Check */}
      {selectedDriveForPreCheck && (
        <Modal
          isOpen={!!selectedDriveForPreCheck}
          onClose={() => setSelectedDriveForPreCheck(null)}
          title={`Eligibility Pre-Check: ${selectedDriveForPreCheck.company}`}
          description="Automated evaluation preview against Team A rule engine parameters"
          footer={
            <Button variant="secondary" onClick={() => setSelectedDriveForPreCheck(null)}>
              Close
            </Button>
          }
        >
          {(() => {
            const res = getPreCheckResult(selectedDriveForPreCheck);
            return (
              <div className="apni-precheck-results">
                <div className={`apni-precheck-banner ${res.eligible ? 'is-eligible' : 'not-eligible'}`}>
                  {res.eligible ? (
                    <>
                      <CheckCircle size={20} className="apni-precheck-icon eligible" />
                      <div>
                        <strong>You are ELIGIBLE for this drive!</strong>
                        <p>Your academic profile meets all specified thresholds.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle size={20} className="apni-precheck-icon ineligible" />
                      <div>
                        <strong>Criteria Thresholds Not Met</strong>
                        <p>One or more requirements are outside candidate eligibility guidelines.</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="apni-reasons-list">
                  <h4>Detailed Evaluation Breakdown:</h4>
                  <ul>
                    {res.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Modal: Apply to Drive */}
      {selectedDriveForApply && (
        <Modal
          isOpen={!!selectedDriveForApply}
          onClose={() => setSelectedDriveForApply(null)}
          title={`Apply to ${selectedDriveForApply.company}`}
          description={`Submit your placement application for ${selectedDriveForApply.package || 'campus drive'}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedDriveForApply(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={applyMutation.isPending}
                disabled={!consent}
                onClick={() =>
                  applyMutation.mutate({
                    driveId: selectedDriveForApply.drive_id,
                    resumeVer: resumeVersion
                  })
                }
              >
                Confirm & Submit Application
              </Button>
            </>
          }
        >
          <div className="apni-apply-form">
            <Input
              label="Resume Version"
              value={resumeVersion}
              onChange={(e) => setResumeVersion(e.target.value)}
              helperText="Active verified resume version from student records"
              required
            />

            <div className="apni-consent-box">
              <label className="apni-checkbox-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I consent to sharing my verified academic records (CGPA, backlogs, branch) with {selectedDriveForApply.company} for recruitment evaluation.
                </span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
