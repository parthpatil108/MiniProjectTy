import { useState } from 'react';
import type { Role } from '../App';

type LoginScreenProps = {
  selectedRole: Role;
  onRoleChange: (role: Role) => void;
  onLogin: (email: string, password: string) => Promise<void>;
};

const roleOptions: Array<{ label: string; value: Role; description: string }> = [
  { label: 'Student', value: 'Student', description: 'View applications and placement status' },
  { label: 'Faculty TPO', value: 'Faculty_TPO', description: 'Review student eligibility and placements' },
  { label: 'Placement Admin', value: 'Placement_Admin', description: 'Manage drives and dashboard operations' }
];

export function LoginScreen({ selectedRole, onRoleChange, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('student@placify.edu');
  const [password, setPassword] = useState('demo123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    await onLogin(email, password);
    setIsSubmitting(false);
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-visual">
          <div className="visual-brand"><span className="logo">P</span><strong>PLACIFY</strong></div>
          <div>
            <span className="eyebrow">Campus Placement Intelligence</span>
            <h1>Discover opportunities.<br />Track your journey.<br />Build your career.</h1>
            <p>A trusted digital workspace for the RIT Placement &amp; Career Cell.</p>
          </div>
          <div className="visual-footer"><span>RIT · AY 2026–27</span><strong>Placement &amp; Career Cell</strong></div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="brand-block">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to continue</h2>
            <p>Sign in to your placement portal.</p>
          </div>
          <label className="field-label" htmlFor="email">Username / Email</label>
          <input id="email" className="text-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <div className="login-options"><label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me</label><button type="button" className="text-button">Forgot password?</button></div>
          <div className="role-list">
            {roleOptions.map((role) => (
              <button key={role.value} type="button" className={`role-option ${selectedRole === role.value ? 'selected' : ''}`} onClick={() => onRoleChange(role.value)}>
                <span className="role-radio" />
                <span><strong>{role.label}</strong><small>{role.description}</small></span>
              </button>
            ))}
          </div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : `Continue as ${selectedRole === 'Faculty_TPO' ? 'Faculty TPO' : selectedRole === 'Placement_Admin' ? 'Placement Admin' : 'Student'}`} <span>→</span>
          </button>
          <small className="login-note">Secure access · PLACIFY placement portal</small>
        </form>
      </section>
    </main>
  );
}
