
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
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
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
    <ErrorOverlay>
      <App />
    </ErrorOverlay>
  </React.StrictMode>
);


