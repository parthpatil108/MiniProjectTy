import { useState } from 'react';
import type { PlacementDrive } from '../App';
import { checkEligibility } from '../services/portalApi';

type DrivesViewProps = { drives: PlacementDrive[]; studentCgpa: number; studentBranch: string; onApply: (driveId: string) => void; isLoading: boolean; error: string; savedDriveIds: string[]; onToggleSaved: (driveId: string) => void };

export function DrivesView({ drives, studentCgpa, studentBranch, onApply, isLoading, error, savedDriveIds, onToggleSaved }: DrivesViewProps) {
  const [query, setQuery] = useState('');
  const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string; checkedAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [resume, setResume] = useState('Priya_Sharma_Resume.pdf');
  const [confirmDetails, setConfirmDetails] = useState(false);
  const filteredDrives = drives.filter((drive) => `${drive.company} ${drive.role}`.toLowerCase().includes(query.toLowerCase()));

  const handleCheckEligibility = async () => {
    if (!selectedDrive) return;
    setChecking(true);
    setEligibility(null);
    try { setEligibility(await checkEligibility(selectedDrive, { cgpa: studentCgpa, branch: studentBranch })); }
    finally { setChecking(false); }
  };

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Drives</span>
          <h2>Active placement drives</h2>
          <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or role" aria-label="Search placement drives" />
        </div>
      </header>
      {error && <div className="inline-error" role="alert">{error}<button type="button">Retry</button></div>}
      {isLoading && <div className="loading-inline">Loading drives from the placement service...</div>}
      {!isLoading && <div className="section-grid">
        {filteredDrives.map((drive) => {
          return <article key={drive.id} className="section-card drive-card" onClick={() => { setSelectedDrive(drive); setEligibility(null); setConfirmDetails(false); }}>
            <div className="section-card-header"><strong>{drive.company}</strong><span className="drive-card-actions"><button className="save-button" type="button" aria-label={`${savedDriveIds.includes(drive.id) ? 'Remove' : 'Save'} ${drive.company} drive`} onClick={(event) => { event.stopPropagation(); onToggleSaved(drive.id); }}>{savedDriveIds.includes(drive.id) ? '♥ Saved' : '♡ Save'}</button><span className="status-tag small-tag">{drive.status}</span></span></div>
            <p>{drive.role}</p>
            <ul><li>{drive.package} · {drive.slots} positions</li><li>Closes {drive.deadline}</li><li>Branches: {drive.branches.join(', ')}</li></ul>
            <button className="secondary-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedDrive(drive); setEligibility(null); setConfirmDetails(false); }}>View drive details</button>
          </article>;
        })}
      </div>}
      {selectedDrive && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedDrive(null)}><section className="drive-modal" role="dialog" aria-modal="true" aria-labelledby="drive-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={() => setSelectedDrive(null)} aria-label="Close drive details">×</button>
        <span className="eyebrow">Drive details · {selectedDrive.id}</span><h3 id="drive-title">{selectedDrive.company} · {selectedDrive.role}</h3>
        <div className="drive-detail-grid"><div><small>Package</small><strong>{selectedDrive.package}</strong></div><div><small>Deadline</small><strong>{selectedDrive.deadline}</strong></div><div><small>Minimum CGPA</small><strong>{selectedDrive.minimumCgpa}</strong></div><div><small>Backlogs</small><strong>{selectedDrive.backlogs}</strong></div></div>
        <p><strong>Required skills:</strong> {selectedDrive.skills.join(' · ')}</p>
        <label className="field-label" htmlFor="resume-select">Resume to submit</label><select id="resume-select" className="search-input" value={resume} onChange={(event) => setResume(event.target.value)}><option>Priya_Sharma_Resume.pdf</option><option>Priya_Sharma_Resume_Updated.pdf</option></select>
        {!eligibility && <button className="primary-button" type="button" onClick={handleCheckEligibility} disabled={checking}>{checking ? 'Checking with eligibility service...' : 'Check eligibility'}</button>}
        {eligibility && <div className={`eligibility-result ${eligibility.eligible ? 'eligible-result' : 'ineligible-result'}`} role="status"><strong>{eligibility.eligible ? 'Congratulations! You are eligible.' : 'You are not eligible for this drive.'}</strong><span>{eligibility.reason ?? 'You can continue to submit your application.'}</span><small>Checked at {eligibility.checkedAt} · Result supplied by Team A</small>{eligibility.eligible && <><label className="confirm-check"><input type="checkbox" checked={confirmDetails} onChange={(event) => setConfirmDetails(event.target.checked)} /> I confirm these application details and resume.</label><button className="primary-button" type="button" disabled={selectedDrive.applied || !confirmDetails} onClick={() => onApply(selectedDrive.id)}>{selectedDrive.applied ? 'Application submitted' : 'Submit application'}</button></>}</div>}
      </section></div>}
    </section>
  );
}
