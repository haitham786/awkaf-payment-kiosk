import React, { Component, ErrorInfo, ReactNode } from 'react';
import { addBootError } from '@/utils/bootErrorLog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs them, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Log to boot error system
    addBootError({
      ts: Date.now(),
      type: 'error',
      message: `React Error Boundary: ${error.message}`,
      stack: error.stack || errorInfo.componentStack || undefined,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Attempt to reload the page
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 1.5rem',
                backgroundColor: '#dc2626',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '40px' }}>⚠️</span>
            </div>
            
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
              }}
            >
              حدث خطأ غير متوقع
            </h1>
            
            <p
              style={{
                fontSize: '1rem',
                color: '#a1a1aa',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
              }}
            >
              نعتذر عن هذا الخطأ. يرجى إعادة المحاولة.
            </p>

            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#16a34a',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginBottom: '1.5rem',
              }}
            >
              إعادة المحاولة
            </button>

            {this.state.error && (
              <details
                style={{
                  marginTop: '1rem',
                  textAlign: 'left',
                  backgroundColor: '#262626',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                }}
              >
                <summary style={{ cursor: 'pointer', color: '#a1a1aa' }}>
                  تفاصيل الخطأ (للدعم الفني)
                </summary>
                <pre
                  style={{
                    marginTop: '0.5rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#ef4444',
                  }}
                >
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
