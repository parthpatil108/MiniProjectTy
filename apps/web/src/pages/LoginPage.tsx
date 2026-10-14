import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Shield, User, GraduationCap, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import './LoginPage.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or account locked.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="apni-login-container">
      <div className="apni-login-card glass-panel">
        <div className="apni-login-header">
          <div className="apni-login-brand">
            <span className="apni-login-logo">A</span>
            <h1 className="apni-login-title">
              Apni<span className="apni-brand__accent">Leap</span>
            </h1>
          </div>
          <p className="apni-login-subtitle">
            Next-Generation Campus Placement Platform & Rule Engine
          </p>
        </div>

        {error && (
          <div className="apni-login-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="apni-login-form">
          <Input
            label="Institutional Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@apnileap.edu"
            required
            autoComplete="email"
          />

          <div className="apni-password-field">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
              rightIcon={
                <button
                  type="button"
                  className="apni-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            rightIcon={<ArrowRight size={18} />}
            className="apni-login-submit-btn"
          >
            Sign In to Portal
          </Button>
        </form>

        <div className="apni-demo-section">
          <span className="apni-demo-header">QUICK DEMO ACCOUNTS</span>
          <div className="apni-demo-buttons">
            <button
              type="button"
              className="apni-demo-btn"
              onClick={() => handleQuickLogin('student@apnileap.edu', 'validpass123')}
            >
              <GraduationCap size={16} className="apni-demo-icon student" />
              <div className="apni-demo-btn__text">
                <span className="apni-demo-btn__role">Student</span>
                <span className="apni-demo-btn__name">Rahul Sharma</span>
              </div>
            </button>

            <button
              type="button"
              className="apni-demo-btn"
              onClick={() => handleQuickLogin('tpo@apnileap.edu', 'tpopass123')}
            >
              <User size={16} className="apni-demo-icon tpo" />
              <div className="apni-demo-btn__text">
                <span className="apni-demo-btn__role">Faculty / TPO</span>
                <span className="apni-demo-btn__name">Amit Nair</span>
              </div>
            </button>

            <button
              type="button"
              className="apni-demo-btn"
              onClick={() => handleQuickLogin('admin@apnileap.edu', 'adminpass123')}
            >
              <Shield size={16} className="apni-demo-icon admin" />
              <div className="apni-demo-btn__text">
                <span className="apni-demo-btn__role">Placement Admin</span>
                <span className="apni-demo-btn__name">Rhea Verma</span>
              </div>
            </button>
          </div>
        </div>

        <div className="apni-login-footer">
          <span>Protected by ApniLeap Scrypt Hasher & Strict 2PL DBMS</span>
        </div>
      </div>
    </div>
  );
}
