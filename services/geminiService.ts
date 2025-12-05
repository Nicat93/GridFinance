import { GoogleGenAI } from "@google/genai";
import { Transaction, RecurringPlan, FinancialSnapshot } from "../types";

// Helper to safely get key
const getApiKey = () => process.env.API_KEY || '';

export const generateInsights = async (
  transactions: Transaction[],
  plans: RecurringPlan[],
  snapshot: FinancialSnapshot
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "API Key not configured. AI features are unavailable.";

  const ai = new GoogleGenAI({ apiKey });

  const summary = {
      balance: snapshot.currentBalance,
      projected: snapshot.projectedBalance,
      income: snapshot.upcomingIncome,
      expenses: snapshot.upcomingExpenses
  };

  // Simplify Data for Token Efficiency
  const simplifiedTx = transactions.slice(0, 40).map(t => `${t.date}: ${t.description} (${t.amount}) [${t.tags.join(',')}]`);
  const simplifiedPlans = plans.map(p => `${p.description} (${p.amount}) ${p.frequency}`);

  const prompt = `
    You are a helpful financial assistant for the 'GridFinance' app.
    
    Current Month Snapshot:
    ${JSON.stringify(summary, null, 2)}
    
    Recent Transactions (Last 40):
    ${JSON.stringify(simplifiedTx, null, 2)}
    
    Recurring Plans:
    ${JSON.stringify(simplifiedPlans, null, 2)}

    Please provide 3-4 concise, actionable insights or observations about this financial situation. 
    Use emojis to make it engaging.
    Focus on: 
    1. Unusual spending or high-frequency categories.
    2. Savings opportunities.
    3. Upcoming risks based on the plans.
    
    Format the output as a clean Markdown list. Keep it brief.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this moment. Please check your network or API quota.";
  }
};

export const suggestTags = async (description: string): Promise<string[]> => {
    const apiKey = getApiKey();
    if (!apiKey) return [];
    
    const ai = new GoogleGenAI({ apiKey });
    try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Classify this financial transaction description into 1 or 2 short, common category tags (e.g. "Food", "Transport", "Utilities", "Shopping"). Description: "${description}". Return ONLY a JSON array of strings.`,
            config: {
                responseMimeType: "application/json"
            }
        });
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error("Gemini Categorization Error:", e);
        return [];
    }
}
