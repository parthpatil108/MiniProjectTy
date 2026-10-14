import React from 'react';
import './Badge.css';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span className={`apni-badge apni-badge--${variant} apni-badge--${size} ${className}`}>
      {dot && <span className="apni-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const norm = (status || '').toUpperCase();

  switch (norm) {
    case 'OFFER_ISSUED':
    case 'SELECTED':
    case 'OPEN':
    case 'PROCESSED':
    case 'UP':
    case 'ELIGIBLE':
      return <Badge variant="success" dot>{status}</Badge>;
    case 'SHORTLISTED':
    case 'INTERVIEW_SCHEDULED':
      return <Badge variant="primary" dot>{status}</Badge>;
    case 'WAITLISTED':
    case 'SCREENING':
    case 'PENDING':
    case 'CONDITIONAL':
      return <Badge variant="warning" dot>{status}</Badge>;
    case 'NOT_ELIGIBLE':
    case 'EXPIRED':
    case 'DEAD_LETTER':
    case 'DOWN':
      return <Badge variant="danger" dot>{status}</Badge>;
    case 'WITHDRAWN':
    case 'CLOSED':
    case 'ARCHIVED':
      return <Badge variant="neutral">{status}</Badge>;
    case 'APPLIED':
    case 'RULE_EVALUATED':
      return <Badge variant="info" dot>{status}</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}
