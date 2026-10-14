import { useState, useMemo } from 'react';
import type { PlacementDrive } from '../App';
import { checkEligibility } from '../services/portalApi';

type DrivesViewProps = {
  drives: PlacementDrive[];
  studentCgpa: number;
  studentBranch: string;
  onApply: (driveId: string) => void;
  isLoading: boolean;
  error: string;
  savedDriveIds: string[];
  onToggleSaved: (driveId: string) => void;
};

export function DrivesView({
  drives,
  studentCgpa,
  studentBranch,
  onApply,
  isLoading,
  error,
  savedDriveIds,
  onToggleSaved
}: DrivesViewProps) {
  const [query, setQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<'ALL' | 'SAVED' | 'OPEN'>('ALL');
  const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string; checkedAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [resume, setResume] = useState('Priya_Sharma_Resume.pdf');
  const [confirmDetails, setConfirmDetails] = useState(false);

  const filteredDrives = useMemo(() => {
    return drives.filter((drive) => {
      const matchesSearch = `${drive.company} ${drive.role} ${drive.skills.join(' ')} ${drive.branches.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesSearch) return false;

      if (tabFilter === 'SAVED') {
        return savedDriveIds.includes(drive.id);
      }
      if (tabFilter === 'OPEN') {
        return drive.status.toUpperCase() === 'OPEN';
      }
      return true;
    });
  }, [drives, query, tabFilter, savedDriveIds]);

  const handleCheckEligibility = async () => {
    if (!selectedDrive) return;
    setChecking(true);
    setEligibility(null);
    try {
      const res = await checkEligibility(selectedDrive, { cgpa: studentCgpa, branch: studentBranch });
      setEligibility(res);
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Opportunities Catalog</span>
          <h2>Active placement drives</h2>
          <p className="page-context">Rule-evaluated against minimum CGPA, branches, and backlogs via Team A.</p>
        </div>
        <div className="topbar-actions">
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or role"
            aria-label="Search placement drives"
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="drives-tabs-row">
        <div className="segmented-control" role="tablist">
          <button
            type="button"
            className={tabFilter === 'ALL' ? 'active' : ''}
            onClick={() => setTabFilter('ALL')}
            role="tab"
            aria-selected={tabFilter === 'ALL'}
          >
            All Drives ({drives.length})
          </button>
          <button
            type="button"
            className={tabFilter === 'OPEN' ? 'active' : ''}
            onClick={() => setTabFilter('OPEN')}
            role="tab"
            aria-selected={tabFilter === 'OPEN'}
          >
            Open Only
          </button>
          <button
            type="button"
            className={tabFilter === 'SAVED' ? 'active' : ''}
            onClick={() => setTabFilter('SAVED')}
            role="tab"
            aria-selected={tabFilter === 'SAVED'}
          >
            Saved Bookmarks ({savedDriveIds.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="loading-inline">
          <div className="spinner" /> Loading drives from the placement service...
        </div>
      )}

      {!isLoading && filteredDrives.length === 0 && (
        <div className="empty-state">
          <strong>No drives matching "{query}"</strong>
          <p>Try clearing your search or switching filter tabs.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setQuery('');
              setTabFilter('ALL');
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {!isLoading && (
        <div className="section-grid">
          {filteredDrives.map((drive) => {
            const isSaved = savedDriveIds.includes(drive.id);
            return (
              <article
                key={drive.id}
                className="section-card drive-card"
                onClick={() => {
                  setSelectedDrive(drive);
                  setEligibility(null);
                  setConfirmDetails(false);
                }}
              >
                <div className="section-card-header">
                  <div>
                    <strong>{drive.company}</strong>
                    <span className="drive-role-subtitle">{drive.role}</span>
                  </div>
                  <span className="drive-card-actions">
                    <button
                      className="save-button"
                      type="button"
                      aria-label={`${isSaved ? 'Remove' : 'Save'} ${drive.company} drive`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaved(drive.id);
                      }}
                    >
                      {isSaved ? '♥ Saved' : '♡ Save'}
                    </button>
                    <span className={`status-tag small-tag ${drive.status.toLowerCase()}`}>
                      {drive.status}
                    </span>
                  </span>
                </div>

                <div className="drive-meta-stats">
                  <div>
                    <small>Package</small>
                    <strong>{drive.package}</strong>
                  </div>
                  <div>
                    <small>Positions</small>
                    <strong>{drive.slots} seats</strong>
                  </div>
                  <div>
                    <small>Min CGPA</small>
                    <strong>{drive.minimumCgpa}+</strong>
                  </div>
                </div>

                <div className="drive-card-branches">
                  <small>Branches: </small>
                  <span>{drive.branches.join(', ')}</span>
                </div>

                <div className="drive-card-skills">
                  {drive.skills.map((skill) => (
                    <span key={skill} className="skill-pill">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="drive-card-footer">
                  <small>Deadline: {drive.deadline}</small>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDrive(drive);
                      setEligibility(null);
                      setConfirmDetails(false);
                    }}
                  >
                    View drive details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Drive Details & Eligibility Modal */}
      {selectedDrive && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelectedDrive(null)}
        >
          <section
            className="drive-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedDrive(null)}
              aria-label="Close drive details"
            >
              ×
            </button>

            <span className="eyebrow">Drive Reference · {selectedDrive.id}</span>
            <h3 id="drive-title">
              {selectedDrive.company} · {selectedDrive.role}
            </h3>

            <div className="drive-detail-grid">
              <div>
                <small>Package CTC</small>
                <strong>{selectedDrive.package}</strong>
              </div>
              <div>
                <small>Application Deadline</small>
                <strong>{selectedDrive.deadline}</strong>
              </div>
              <div>
                <small>Minimum CGPA</small>
                <strong>{selectedDrive.minimumCgpa}</strong>
              </div>
              <div>
                <small>Backlogs Policy</small>
                <strong>{selectedDrive.backlogs}</strong>
              </div>
              <div>
                <small>Eligible Branches</small>
                <strong>{selectedDrive.branches.join(', ')}</strong>
              </div>
              <div>
                <small>Drive Status</small>
                <strong className={`status-tag small-tag ${selectedDrive.status.toLowerCase()}`}>
                  {selectedDrive.status}
                </strong>
              </div>
            </div>

            <div className="drive-skills-section">
              <strong>Required skills &amp; competencies:</strong>
              <div className="skills-row">
                {selectedDrive.skills.map((skill) => (
                  <span key={skill} className="skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="resume-section">
              <label className="field-label" htmlFor="resume-select">
                Select resume to submit
              </label>
              <select
                id="resume-select"
                className="search-input"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
              >
                <option>Priya_Sharma_Resume.pdf</option>
                <option>Priya_Sharma_Resume_Updated.pdf</option>
              </select>
            </div>

            {!eligibility && (
              <button
                className="primary-button"
                type="button"
                onClick={handleCheckEligibility}
                disabled={checking}
              >
                {checking ? 'Checking with eligibility service...' : 'Check eligibility'}
              </button>
            )}

            {eligibility && (
              <div
                className={`eligibility-result ${eligibility.eligible ? 'eligible-result' : 'ineligible-result'}`}
                role="status"
              >
                <strong>
                  {eligibility.eligible
                    ? 'Congratulations! You are eligible.'
                    : 'You are not eligible for this drive.'}
                </strong>
                <span>
                  {eligibility.reason ??
                    'Your CGPA and branch satisfy the eligibility rule chain evaluated by Team A.'}
                </span>
                <small>
                  Checked at {eligibility.checkedAt} · Evaluated by Team A Engine
                </small>

                {eligibility.eligible && (
                  <>
                    <label className="confirm-check">
                      <input
                        type="checkbox"
                        checked={confirmDetails}
                        onChange={(e) => setConfirmDetails(e.target.checked)}
                      />{' '}
                      I confirm these application details and resume for submission.
                    </label>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={selectedDrive.applied || !confirmDetails}
                      onClick={() => onApply(selectedDrive.id)}
                    >
                      {selectedDrive.applied ? 'Application submitted' : 'Submit application'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
