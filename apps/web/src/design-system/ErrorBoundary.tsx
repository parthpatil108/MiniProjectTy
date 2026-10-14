import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ApniLeap ErrorBoundary caught]', error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px'
          }}
        >
          <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>
            <AlertOctagon size={48} />
          </div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '450px', marginBottom: '24px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <Button
            variant="primary"
            leftIcon={<RotateCcw size={16} />}
            onClick={() => {
              this.reset();
              window.location.reload();
            }}
          >
            Reload Component
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
