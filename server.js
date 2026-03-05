import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.post('/api/parseScenario', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Parse this bill splitting scenario and return a JSON object.
      Scenario: "${message}"
      
      Rules:
      1. Identify all unique participants.
      2. Identify all expenses, their amounts, who paid them, and who they should be split among based on the text.
      3. If not specified, assume an expense is split among ALL participants.
      4. Return ONLY a JSON object with this structure:
      {
        "participants": ["Name1", "Name2"],
        "expenses": [
          { "description": "Item Name", "amount": 10.5, "paidBy": "Name1", "splitAmong": ["Name1", "Name2"] }
        ]
      }`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        participants: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        expenses: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    description: { type: Type.STRING },
                                    amount: { type: Type.NUMBER },
                                    paidBy: { type: Type.STRING },
                                    splitAmong: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["description", "amount", "paidBy", "splitAmong"]
                            }
                        }
                    },
                    required: ["participants", "expenses"]
                }
            }
        });

        const parsedData = JSON.parse(response.text || '{}');
        res.json(parsedData);
    } catch (error) {
        console.error('Error in API:', error);
        res.status(500).json({ error: error.message || 'Server error processing request' });
    }
});

// For production static serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
