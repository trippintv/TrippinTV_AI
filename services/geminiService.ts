/**
 * Frontend interface for AI services.
 * Now proxies requests to the Express backend.
 */

export const moderateContent = async (text: string, contentType: string): Promise<{ safe: boolean; reason?: string }> => {
  try {
    const response = await fetch('/api/safety/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, contentType })
    });
    if (!response.ok) return { safe: true };
    return await response.json();
  } catch (error) {
    return { safe: true };
  }
};

export const generateFunnyCaption = async (description: string): Promise<string> => {
  try {
    const response = await fetch('/api/ai/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    const data = await response.json();
    return data.caption || "Someone's trippin' hard! 😂";
  } catch (error) {
    return "This one's wild! #TrippinTV";
  }
};
