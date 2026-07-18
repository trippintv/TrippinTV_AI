// Centralized API base + fetch helper.
// In the web app the backend is served from the same origin (relative "/api"),
// so VITE_API_URL is empty. For native builds (Capacitor/Android) where the
// WebView is bundled and the backend is hosted separately, set VITE_API_URL to
// the backend origin, e.g. https://api.trippintv.ai
export const API_BASE: string = import.meta.env.VITE_API_URL || '';

export const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, options);
};
