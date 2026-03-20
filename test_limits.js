import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testLimits() {
  const models = [
    // "gemini-2.0-flash",
    "gemini-3-flash-preview",
    // "gemini-3-pro-preview",
    // "gemini-2.5-flash",
    // "gemini-pro"
  ];

  for (const model of models) {
    try {
      const resp = await ai.models.generateContent({
        model: model,
        contents: "Say hello",
      });
      console.log(model, "Success:", resp.text);
    } catch (e) {
      console.log(model, "Error:", e.message);
    }
  }
}

testLimits();
