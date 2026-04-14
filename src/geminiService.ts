import { GoogleGenAI } from "@google/genai";
import { UserPreferences, WeatherData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getDressingSuggestions(prefs: UserPreferences, weather: WeatherData) {
  const prompt = `
    You are KAIT, a poetic and minimalist dressing advisor.
    Based on the following user preferences and weather, provide 3 specific clothing items.
    
    User Preferences:
    - Language: ${prefs.language}
    - Sensitivity: ${prefs.sensitivity || 'normal'}
    - Style Archetype: ${prefs.archetype || 'classic'} (This defines the user's thermal and aesthetic baseline)
    - Silhouette Preference: ${prefs.silhouette || 'neutral'} (This defines the cut and fit of the clothing)
    
    Current Weather:
    - Temperature: ${weather.temp}°C
    - Condition: ${weather.condition}
    - UV Index: ${weather.uvIndex}
    - Rain Expected: ${weather.rainExpected}
    
    Requirements:
    1. Return a JSON array of 3 objects.
    2. Each object must have:
       - "name": A minimalist, poetic name for the item.
       - "description": A very short description.
       - "affiliateLink": A mock link to either Zalando or Amazon.
       - "imageKeywords": 3-4 highly specific keywords that MUST include the user's silhouette preference (${prefs.silhouette}) and style archetype (${prefs.archetype}) to ensure the visual representation matches their taste (e.g., "${prefs.silhouette} minimalist ${prefs.archetype} style coat").
    3. The tone must be minimalist and precise.
    4. Use the user's selected language (${prefs.language}) for the names and descriptions.
    
    Example JSON structure:
    [
      { "name": "...", "description": "...", "affiliateLink": "...", "imageKeywords": "..." }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    
    const text = response.text;
    if (!text) throw new Error("No response text");

    // Extract JSON from the response
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse suggestions");
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return [
      { name: "essential layer", description: "a simple base for your day.", affiliateLink: "https://www.zalando.com", imageKeywords: "minimalist shirt" },
      { name: "structured outer", description: "protection against the elements.", affiliateLink: "https://www.amazon.com", imageKeywords: "minimalist coat" },
      { name: "refined trouser", description: "balance in every step.", affiliateLink: "https://www.zalando.com", imageKeywords: "minimalist pants" }
    ];
  }
}
