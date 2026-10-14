import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Award,
  Ban,
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { StatusBadge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Modal } from '../design-system/Modal';
import { EmptyState } from '../design-system/EmptyState';
import { TableSkeleton } from '../design-system/Skeleton';
import { useToast } from '../design-system/Toast';
import './ApplicationsPage.css';

const STATE_STEPS = [
  'APPLIED',
  'SCREENING',
  'RULE_EVALUATED',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'OFFER_ISSUED'
];

export function ApplicationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedAppForOffer, setSelectedAppForOffer] = useState<any | null>(null);
  const [selectedAppForSlot, setSelectedAppForSlot] = useState<any | null>(null);

  const { data: applications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: () => apiClient<any[]>('/api/v1/ui/applications')
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (appId: string) => {
      return apiClient(`/api/v1/applications/${appId}/withdraw`, { method: 'POST' });
    },
    onSuccess: () => {
      addToast({ type: 'info', title: 'Application Withdrawn', message: 'The application has entered terminal state WITHDRAWN.' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err: any) => {
      addToast({ type: 'error', title: 'Withdrawal Failed', message: err.message });
    }
  });

  // Slot reserve mutation
  const bookSlotMutation = useMutation({
    mutationFn: async ({ appId, slotId }: { appId: string; slotId: string }) => {
      return apiClient('/internal/v1/locks/acquire', {
        method: 'POST',
        body: JSON.stringify({ slot_id: slotId, holder_id: user?.user_id })
      });
    },
    onSuccess: (data: any) => {
      addToast({
        type: 'success',
        title: 'Interview Slot Reserved!',
        message: `Exclusive lock lease granted: ${data?.lease_id || 'Active'}`
      });
      setSelectedAppForSlot(null);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Slot Reservation Failed',
        message: err.message || 'Slot currently locked or unavailable.'
      });
    }
  });

  const getStepStatus = (stepState: string, currentState: string) => {
    const currentIdx = STATE_STEPS.indexOf(currentState);
    const stepIdx = STATE_STEPS.indexOf(stepState);

    if (currentState === 'NOT_ELIGIBLE' || currentState === 'WITHDRAWN' || currentState === 'EXPIRED') {
      if (stepState === 'APPLIED') return 'completed';
      return 'failed';
    }

    if (currentIdx === -1) return 'pending';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'pending';
  };

  return (
    <div className="apni-apps-page">
      <div className="apni-apps-header">
        <div>
          <h2 className="apni-page-title">
            {user?.role === 'Student' ? 'My Placement Applications' : 'Applications & State Machine Pipeline'}
          </h2>
          <p className="apni-page-subtitle">
            Authoritative state tracking governed by Team C DBMS & Team A Queue Engine
          </p>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <EmptyState
          title="Failed to Load Applications"
          description={(error as any)?.message}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No Placement Applications Found"
          description={user?.role === 'Student' ? "You haven't submitted any applications yet." : "No candidate applications in the system."}
        />
      ) : (
        <div className="apni-apps-list">
          {applications.map((app: any) => {
            const isTerminal = ['OFFER_ISSUED', 'NOT_ELIGIBLE', 'WITHDRAWN', 'EXPIRED'].includes(app.state);
            const canWithdraw = !isTerminal && app.state !== 'SELECTED';

            return (
              <div key={app.application_id} className="apni-app-card glass-panel">
                <div className="apni-app-card__header">
                  <div className="apni-app-card__info">
                    <span className="apni-app-card__id">APP ID: {app.application_id}</span>
                    <span className="apni-app-card__drive">Drive: {app.drive_id} • Student: {app.student_id}</span>
                  </div>
                  <div className="apni-app-card__status-wrap">
                    <StatusBadge status={app.state || 'APPLIED'} />
                    <span className="apni-app-card__ver">v{app._version || app.version || 1}</span>
                  </div>
                </div>

                {/* State Machine Step Progress */}
                <div className="apni-timeline-container" aria-label="Application state progression">
                  <div className="apni-timeline-steps">
                    {STATE_STEPS.map((step, idx) => {
                      const stepStatus = getStepStatus(step, app.state);
                      return (
                        <div key={step} className={`apni-timeline-step ${stepStatus}`}>
                          <div className="apni-timeline-step__marker">
                            {stepStatus === 'completed' ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          <span className="apni-timeline-step__label">{step.replace('_', ' ')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="apni-app-card__footer">
                  <div className="apni-app-card__timestamps">
                    <Clock size={13} />
                    <span>Updated: {new Date(app.updated_at || app._updatedAt || Date.now()).toLocaleDateString()}</span>
                  </div>

                  <div className="apni-app-card__actions">
                    {app.state === 'SHORTLISTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Calendar size={14} />}
                        onClick={() => setSelectedAppForSlot(app)}
                      >
                        Book Interview Slot
                      </Button>
                    )}

                    {app.state === 'SELECTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Award size={14} />}
                        onClick={() => setSelectedAppForOffer(app)}
                      >
                        View Placement Offer
                      </Button>
                    )}

                    {app.state === 'OFFER_ISSUED' && (
                      <div className="apni-offer-confirmed">
                        <CheckCircle2 size={16} />
                        <span>Offer Accepted & Committed!</span>
                      </div>
                    )}

                    {canWithdraw && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Ban size={14} />}
                        onClick={() => {
                          if (confirm('Are you sure you want to withdraw this application? This transition is terminal.')) {
                            withdrawMutation.mutate(app.application_id);
                          }
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: View Offer */}
      {selectedAppForOffer && (
        <Modal
          isOpen={!!selectedAppForOffer}
          onClose={() => setSelectedAppForOffer(null)}
          title="Formal Placement Offer"
          description={`Application ID: ${selectedAppForOffer.application_id}`}
          footer={
            <Button variant="primary" onClick={() => setSelectedAppForOffer(null)}>
              Acknowledge Offer
            </Button>
          }
        >
          <div className="apni-offer-modal-content">
            <div className="apni-offer-congrats">
              <Award size={36} className="apni-offer-icon" />
              <h3>Congratulations!</h3>
              <p>You have been selected for campus placement with confirmed allocation.</p>
            </div>
            <div className="apni-offer-details-box">
              <div className="apni-detail-row">
                <span>Drive Allocation:</span>
                <strong>{selectedAppForOffer.drive_id}</strong>
              </div>
              <div className="apni-detail-row">
                <span>Candidate ID:</span>
                <strong>{selectedAppForOffer.student_id}</strong>
              </div>
              <div className="apni-detail-row">
                <span>Verification State:</span>
                <StatusBadge status="SELECTED" />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Book Slot */}
      {selectedAppForSlot && (
        <Modal
          isOpen={!!selectedAppForSlot}
          onClose={() => setSelectedAppForSlot(null)}
          title="Reserve Interview Slot"
          description="Exclusive slot lock managed by Team A lock manager"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedAppForSlot(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={bookSlotMutation.isPending}
                onClick={() =>
                  bookSlotMutation.mutate({
                    appId: selectedAppForSlot.application_id,
                    slotId: `SLOT-${selectedAppForSlot.drive_id}-1`
                  })
                }
              >
                Acquire Exclusive Lock
              </Button>
            </>
          }
        >
          <div className="apni-slot-box">
            <p>Select your interview slot to acquire an exclusive lock:</p>
            <div className="apni-slot-card">
              <Calendar size={18} />
              <div>
                <strong>Slot #1 • Tomorrow 10:00 AM - 11:00 AM</strong>
                <span>Technical Interview Panel • Virtual Room 1</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
