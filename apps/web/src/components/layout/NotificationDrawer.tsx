import React from 'react';
import { X, CheckCircle2, AlertTriangle, Bell, Clock } from 'lucide-react';
import './NotificationDrawer.css';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  if (!isOpen) return null;

  const mockLiveEvents = [
    {
      id: '1',
      title: 'Offer Extended — TechCorp Inc.',
      message: 'Your slot has been confirmed and offer issued! Package: 12 LPA',
      time: 'Just now',
      type: 'success'
    },
    {
      id: '2',
      title: 'Shortlist Published — InnovateX Labs',
      message: 'Rankings generated via AVL index. You are ranked #2 for Drive #2',
      time: '12m ago',
      type: 'info'
    },
    {
      id: '3',
      title: 'Interview Slot Released',
      message: 'Interview slot lock SLOT-550e8400 has been released and waitlist recalculated.',
      time: '1h ago',
      type: 'warning'
    }
  ];

  return (
    <div className="apni-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="apni-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="apni-drawer__header">
          <div className="apni-drawer__title-row">
            <Bell size={18} className="apni-drawer__icon" />
            <h3 className="apni-drawer__title">Live Notifications</h3>
          </div>
          <button className="apni-drawer__close" onClick={onClose} aria-label="Close notification drawer">
            <X size={18} />
          </button>
        </div>

        <div className="apni-drawer__content">
          <div className="apni-drawer__stream-status">
            <span className="apni-drawer__stream-dot" />
            <span>Connected to Team C Real-Time Outbox Stream</span>
          </div>

          <div className="apni-notification-list">
            {mockLiveEvents.map((item) => (
              <div key={item.id} className={`apni-notification-card apni-notification-card--${item.type}`}>
                <div className="apni-notification-card__icon">
                  {item.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="apni-notification-card__body">
                  <div className="apni-notification-card__header">
                    <span className="apni-notification-card__title">{item.title}</span>
                    <span className="apni-notification-card__time">
                      <Clock size={11} /> {item.time}
                    </span>
                  </div>
                  <p className="apni-notification-card__msg">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
