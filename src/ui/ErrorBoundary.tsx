import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

/**
 * A lecture tool must never show a blank white projector screen.
 * If any module throws, we keep the shell alive, show what happened and offer
 * a one-click reset that clears only the saved model (localStorage), not the app.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('StructVision module error:', error);
  }

  resetModels = () => {
    try {
      localStorage.removeItem('structvision.v2');
    } catch {
      /* ignore */
    }
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-4" style={{ background: 'var(--app)' }}>
        <div className="card max-w-lg w-full p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            <h1 className="text-[15px] font-extrabold">This screen hit an error</h1>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            Your work is still in the page, the model that caused this is usually an extreme input (for example a zero-length member or a
            support outside the span). The rest of the app is unaffected.
          </p>
          <pre
            className="text-[10.5px] num rounded-lg p-2 overflow-auto max-h-32"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--line)', color: 'var(--compression)' }}
          >
            {this.state.error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg px-3 py-1.5 text-[12px] font-bold"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}
            >
              Try again
            </button>
            <button
              onClick={this.resetModels}
              className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white flex items-center gap-1.5"
              style={{ background: 'var(--accent)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset saved model & reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
