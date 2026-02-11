import OpenAI from 'openai';
import { ContentIdea } from '@/types';

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

export async function generateContentIdeas(topic: string, discussions: string[]): Promise<ContentIdea[]> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Missing GROQ_API_KEY environment variable');
    }

    try {
        const prompt = `
        Given the data (title and comments of the post), generate a highly engaging short-form video idea. 
        The idea must include a strong hook, clear topic angle, target pain-point, and a simple execution format (talking head, cinematic reel, podcast clip, etc.). 
        Ensure ideas are aligned with the creator’s brand voice, optimized for retention, and designed to attract leads or clients. 
        Output in a structured list with: Hook + Concept + Why it works + CTA suggestion.
        
        Generate only the top 5 ideas based on the provided discussions from r/${topic}.
        
        Discussions:
        ${discussions.join('\n\n---\n\n').substring(0, 15000)} // Truncate to avoid token limits

        IMPORTANT: Format the output as a JSON array of objects with the following keys:
        - "hook": A strong, attention-grabbing opening line.
        - "concept": The core idea and execution format.
        - "why": Why this works (pain point/psychology).
        - "cta": A suggested Call to Action.

        Example format:
        [
            {
                "hook": "Stop doing X if you want Y...",
                "concept": "Talking head explaining the common mistake...",
                "why": "Addresses a major pain point...",
                "cta": "Comment 'GUIDE' for my free resource."
            }
        ]
        
        Do not include any explanation, just the JSON array.
        `;

        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are a helpful content strategist assistant.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        if (!content) return [];

        try {
            // Attempt to parse JSON response
            const ideas = JSON.parse(content);
            if (Array.isArray(ideas)) {
                return ideas as ContentIdea[];
            }
            return [];
        } catch (e) {
            console.warn('Failed to parse AI response as JSON', e);
            // Attempt to extract JSON if wrapped in markdown code blocks
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
                try {
                    const extracted = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                    return extracted as ContentIdea[];
                } catch (parseError) {
                    console.error('Failed to parse extracted JSON', parseError);
                }
            }
            return [];
        }
    } catch (error) {
        console.error('Error generating content ideas:', error);
        throw new Error('Failed to generate ideas using AI.');
    }
}
