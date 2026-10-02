import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#475569',
            minHeight: '320px',
          }}
        >
          <AlertTriangle size={32} color="#dc2626" />
          <h3 style={{ margin: 0, color: '#0f172a' }}>
            {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
          </h3>
          <p style={{ margin: 0, maxWidth: 420, fontSize: '0.9rem' }}>
            {this.state.error.message || 'An unexpected error occurred while rendering this view.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#D3070B',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
