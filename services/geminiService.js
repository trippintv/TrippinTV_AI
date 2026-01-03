
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateFunnyCaption = async (description) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a funny, street-slang, "trippin" style caption for a video described as: "${description}". Keep it short and viral.`,
      config: {
        temperature: 0.8,
        maxOutputTokens: 100,
      }
    });
    return response.text?.trim() || "Someone's trippin' hard! 😂";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "This one's wild! #TrippinTV";
  }
};

export const moderateComment = async (comment) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Determine if this comment is safe for a community video feed. No hate speech or extreme vulgarity. Respond with ONLY 'SAFE' or 'UNSAFE'. Comment: "${comment}"`,
    });
    return response.text?.includes('SAFE') ?? true;
  } catch (error) {
    return true;
  }
};
