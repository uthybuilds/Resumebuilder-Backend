import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

export default model;
