
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface ParsedReceipt {
  description: string;
  amount: number;
  category: 'Food' | 'Transport' | 'Lodging' | 'Entertainment' | 'Other';
}

export const parseReceipt = async (base64Image: string): Promise<ParsedReceipt | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: "Extract the following details from this receipt image: description (brief, e.g., 'Lunch at Mario's'), total amount (numeric), and the most suitable category from: Food, Transport, Lodging, Entertainment, Other." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] // remove data:image/jpeg;base64,
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { 
              type: Type.STRING,
              description: "Must be one of: Food, Transport, Lodging, Entertainment, Other"
            }
          },
          required: ["description", "amount", "category"]
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    return json as ParsedReceipt;
  } catch (error) {
    console.error("Error parsing receipt:", error);
    return null;
  }
};
