import { useState } from 'react';
import type { AuthSession } from '../services/portalApi';

export function ProfileView({ session }: { session: AuthSession }) {
  const [skills, setSkills] = useState(['TypeScript', 'Node.js', 'React', 'Python', 'Algorithms', 'SQL']);
  const [newSkill, setNewSkill] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const addSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim() || skills.includes(newSkill.trim())) return;
    setSkills(prev => [...prev, newSkill.trim()]);
    setNewSkill('');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(prev => prev.filter(s => s !== skillToRemove));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Account · RIT Placement &amp; Career Cell</span>
          <h2>Candidate Profile</h2>
          <p className="page-context">Synchronized with Team C Master Records (Student ID: STU-1001).</p>
        </div>
        <span className="status-pill">96% Complete</span>
      </header>

      {savedNotice && (
        <div className="success-banner" role="status">
          ✓ Profile skills updated and synced with Team B skill graph.
        </div>
      )}

      {/* Main Profile Info Card */}
      <article className="profile-card">
        <div className="profile-avatar">
          {session.name.split(' ').map((part) => part[0]).join('')}
        </div>
        <div className="profile-meta">
          <h3>{session.name}</h3>
          <p>{session.email}</p>
          <div className="profile-tag-row">
            <span className="status-tag small-tag">{session.role}</span>
            <span className="status-tag small-tag" style={{ background: '#e9faf5', color: '#187a59' }}>
              Academic Standing: Excellent
            </span>
          </div>
        </div>
      </article>

      {/* Placement Readiness Breakdown */}
      <div className="profile-completion">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Readiness Index</span>
            <h3>Placement Season Qualification</h3>
          </div>
          <strong>96%</strong>
        </div>
        <div className="readiness-bar">
          <i style={{ width: '96%' }} />
        </div>
        <div className="completion-grid">
          <span>✓ Verified Academic CGPA (9.1)</span>
          <span>✓ Zero Active Backlogs</span>
          <span>✓ Verified Resume on File</span>
          <span>✓ Core Technical Skills</span>
          <span>✓ Attendance Benchmark (92%)</span>
          <span>✓ Interview Slot Active</span>
        </div>
      </div>

      {/* Academic Details & Skills Grid */}
      <div className="section-grid">
        <article className="section-card">
          <div className="section-card-header">
            <strong>Academic Credentials</strong>
          </div>
          <ul className="profile-details-list">
            <li><span>University / College:</span><strong>R.I.T. College of Engineering</strong></li>
            <li><span>Department:</span><strong>Computer Science &amp; Engineering</strong></li>
            <li><span>Graduation Year:</span><strong>Class of 2027 (4th Year)</strong></li>
            <li><span>Cumulative GPA:</span><strong style={{ color: '#277b88' }}>9.1 / 10.0</strong></li>
            <li><span>Standing:</span><strong>Top 5% of Department Cohort</strong></li>
          </ul>
        </article>

        <article className="section-card">
          <div className="section-card-header">
            <strong>Verified Technical Skills</strong>
            <small>{skills.length} skills listed</small>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            These skills map directly to Team B bipartite graph weighting for shortlisting.
          </p>

          <div className="profile-skills-chip-container">
            {skills.map((skill) => (
              <span key={skill} className="skill-pill profile-skill-pill">
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  aria-label={`Remove ${skill}`}
                  className="skill-remove-btn"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={addSkill} className="add-skill-form">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add skill (e.g. Go, Docker)..."
              className="text-input"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
            />
            <button type="submit" className="secondary-button" style={{ fontSize: '0.8rem' }}>
              Add Skill
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
