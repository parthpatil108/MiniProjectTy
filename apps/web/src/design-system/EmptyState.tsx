import React from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <Inbox size={40} />,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`apni-empty-state ${className}`}>
      <div className="apni-empty-state__icon">{icon}</div>
      <h4 className="apni-empty-state__title">{title}</h4>
      {description && <p className="apni-empty-state__description">{description}</p>}
      {action && <div className="apni-empty-state__action">{action}</div>}
    </div>
  );
}
