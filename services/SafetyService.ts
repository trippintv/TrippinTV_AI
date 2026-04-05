
export interface SafetyReport {
  timestamp: string;
  type: string; // 'AI_AUTO' or 'USER_MANUAL'
  category: string; // 'comment', 'bio', 'message', 'video_meta', 'video_content', 'user'
  content: string;
  reason: string;
  reporter?: string;
}

export const getSafetyReports = async (): Promise<SafetyReport[]> => {
  const response = await fetch('/api/safety');
  return await response.json();
};

export const addSafetyReport = async (report: Omit<SafetyReport, 'id' | 'timestamp'>) => {
  await fetch('/api/safety', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
};

export const clearSafetyReports = async () => {
  await fetch('/api/safety', {
    method: 'DELETE'
  });
};
