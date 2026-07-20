
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Surface runtime errors on-screen (useful inside the Android WebView where
// there is no browser devtools). Falls back to a visible red overlay instead
// of a silent black screen.
class ErrorOverlay extends React.Component<
  { error: Error },
  { error: Error | null }
> {
  constructor(props: { error: Error }) {
    super(props);
    this.state = { error: props.error };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <pre
        style={{
          color: '#fff',
          background: '#900',
          padding: 16,
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        APP ERROR:{'\n'}
        {String(this.state.error.stack || this.state.error.message)}
      </pre>
    );
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorOverlay error={new Error('')}>
      <App />
    </ErrorOverlay>
  </React.StrictMode>
);

window.addEventListener('error', (e) => {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;background:#900;color:#fff;padding:16px;font:13px monospace;white-space:pre-wrap;z-index:99999;overflow:auto';
  el.textContent = 'WINDOW ERROR:\n' + (e.error?.stack || e.message);
  document.body.appendChild(el);
});
window.addEventListener('unhandledrejection', (e) => {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;background:#900;color:#fff;padding:16px;font:13px monospace;white-space:pre-wrap;z-index:99999;overflow:auto';
  el.textContent = 'UNHANDLED PROMISE:\n' + String(e.reason);
  document.body.appendChild(el);
});
