import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testChat() {
  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash-lite",
      config: {
        systemInstruction: "You are a helpful mentor."
      }
    });

    const response = await chat.sendMessage({
      message: "Hello!"
    });

    console.log("Success:", response.text);
  } catch (error) {
    console.error("Error generating chat:", error.message, error);
  }
}

testChat();
