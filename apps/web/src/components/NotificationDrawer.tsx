import type { LiveConnectionState } from '../services/portalApi';

type NotificationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  events: Array<{ id: number; text: string; time: string; type?: string }>;
  liveState: LiveConnectionState;
  onClear: () => void;
};

export function NotificationDrawer({
  isOpen,
  onClose,
  events,
  liveState,
  onClear
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="notification-drawer"
        role="dialog"
        aria-label="Live updates and notifications"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h3>Live Feed &amp; Notices</h3>
            <span className={`status-pill ${liveState !== 'connected' ? 'status-warning' : ''}`}>
              <i className="dot" /> {liveState === 'connected' ? 'SSE Connected (Team C)' : 'Reconnecting...'}
            </span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close drawer">
            ×
          </button>
        </div>

        <div className="drawer-toolbar">
          <span>{events.length} recent system event{events.length === 1 ? '' : 's'}</span>
          {events.length > 0 && (
            <button className="quiet-button" onClick={onClear} type="button">
              Clear stream
            </button>
          )}
        </div>

        <div className="drawer-content">
          {events.length === 0 ? (
            <div className="empty-state">
              <strong>No notifications yet</strong>
              <p>State changes committed by Team C and evaluations from Team A will appear here in real time.</p>
            </div>
          ) : (
            <div className="drawer-event-list">
              {events.map((evt) => (
                <div key={evt.id} className="drawer-event-item">
                  <div className="drawer-event-icon">
                    {evt.text.includes('shortlist') || evt.text.includes('confirmed') || evt.text.includes('Offer') ? '✓' : 'ℹ'}
                  </div>
                  <div className="drawer-event-body">
                    <p>{evt.text}</p>
                    <small>{evt.time}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
