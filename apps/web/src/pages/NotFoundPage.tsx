import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../design-system/Button';
import './NotFoundPage.css';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="apni-notfound-page">
      <div className="apni-notfound-card glass-panel">
        <div className="apni-notfound-icon">
          <Compass size={64} />
        </div>
        <h1 className="apni-notfound-title">404 — Ledger Entry Not Found</h1>
        <p className="apni-notfound-text">
          The recruitment route, candidate record, or administrative portal view you are trying to access does not exist in ApniLeap.
        </p>
        <div className="apni-notfound-actions">
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            leftIcon={<Home size={16} />}
            onClick={() => navigate('/')}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
