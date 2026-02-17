/**
 * Prompt storage — persists custom AI prompts in localStorage.
 * Falls back to built-in defaults when no custom prompt is stored.
 */

export const PROMPT_KEYS = {
    IDEAS: 'prompt_content_ideas',
    HOOKS: 'prompt_viral_hooks',
    SCRIPTS: 'prompt_video_scripts',
} as const;

// --------------- DEFAULT PROMPTS ---------------

export const DEFAULT_IDEAS_PROMPT = `Given the data (title and comments of the post), generate a highly engaging short-form video idea. 
The idea must include a strong hook, clear topic angle, target pain-point, and a simple execution format (talking head, cinematic reel, podcast clip, etc.). 
Ensure ideas are aligned with the creator's brand voice, optimized for retention, and designed to attract leads or clients. 
Output in a structured list with: Hook + Concept + Why it works + CTA suggestion.

Generate only the top 5 ideas based on the provided discussions from r/{{SUBREDDIT}}.

Discussions:
{{DISCUSSIONS}}

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

Do not include any explanation, just the JSON array.`;

export const DEFAULT_HOOKS_PROMPT = `You are an expert viral hook writer.

Your job is to generate HIGH-RETENTION hooks for short-form content, Reels, TikToks, LinkedIn videos, or YouTube Shorts.

You will be given a dataset containing insights such as:
- Reddit posts + comments
- Customer pain points
- Market frustrations
- Popular opinions
- Contrarian takes
- Emotional triggers
- Stories or experiences

Your goal is to extract the most emotionally charged, curiosity-driven, and scroll-stopping angle.

----------------------------------------
HOOK WRITING RULES (Follow Strictly)
----------------------------------------

1. Hooks must be 1–2 lines maximum.
2. They must instantly create curiosity or tension.
3. They should feel human, conversational, and punchy.
4. Avoid generic hooks like:
   - "Did you know…"
   - "In today's video…"
   - "Let's talk about…"
5. Use proven viral hook frameworks:
   - Contrarian take
   - Shocking truth
   - Pain-point callout
   - Relatable struggle
   - Pattern interrupt
   - Bold claim
   - "Nobody tells you this…"
   - "This is why you're stuck…"

6. Hooks should target emotions like:
   - frustration
   - ambition
   - fear of missing out
   - curiosity
   - desire for results

7. Output hooks in a list format.
8. Generate 10 hooks per dataset.

----------------------------------------
TONE STYLE
----------------------------------------

- Direct
- Modern
- Slightly edgy
- Extremely engaging
- Feels like a creator speaking, not AI

----------------------------------------
EXAMPLES (Study These Carefully)
----------------------------------------

Example 1:
Data: People complain they post content but get no clients.
Hook: "Your content isn't failing… your offer is."

Example 2:
Data: Reddit users say motivation never lasts.
Hook: "Motivation is useless. Systems are everything."

Example 3:
Data: People struggle with LinkedIn growth.
Hook: "Most people are invisible on LinkedIn for one stupid reason…"

Example 4:
Data: Entrepreneurs feel burnt out from working too much.
Hook: "You don't need more hustle. You need leverage."

Example 5:
Data: Creators say editing takes too long.
Hook: "Editing isn't hard… you're just doing it like an amateur."

----------------------------------------
NOW YOUR TASK
----------------------------------------

Here is the dataset:

{{DISCUSSIONS}}

Step 1: Identify the strongest pain point, desire, or contradiction inside the dataset.
Step 2: Generate 10 viral hooks based on it.
Step 3: Make each hook unique in angle (don't repeat the same structure).

IMPORTANT: Return the hooks as a JSON array of strings. No explanations. No extra text. Just the JSON array.

Example output format:
["Hook one here", "Hook two here", "Hook three here"]`;

export const DEFAULT_SCRIPTS_PROMPT = `You are an expert short-form scriptwriter.

Your job is to write HIGH-RETENTION video scripts for Instagram Reels, TikToks, YouTube Shorts, and LinkedIn videos.

You will be given:
1. A selected hook (already proven strong)
2. A content idea/topic (selected from research)

Your task is to generate **2 different script variations** for the same hook + idea.

Each variation must feel fresh, unique, and structured differently.

---------------------------------------------------
SCRIPT REQUIREMENTS (STRICT)
---------------------------------------------------

1. LENGTH:
- 30–45 seconds max
- Short sentences
- Fast pacing

2. STRUCTURE:
Each script must follow this flow:

HOOK (0–2s)
→ Problem or tension (2–6s)
→ Key insight / shift in thinking (6–15s)
→ Value delivery (15–35s)
→ Clear takeaway + CTA (last 5s)

3. RETENTION RULES:
- Every line must create curiosity or forward momentum
- Avoid filler words
- Add pattern interrupts like:
  - "Here's the twist…"
  - "But most people miss this…"
  - "This is where it gets scary…"

4. TONE:
- Human
- Direct
- Slightly edgy
- Creator-style, not corporate
- No robotic teaching tone

5. OUTPUT FORMAT:
Write in a clean, line-by-line spoken format like a voiceover script.

Example formatting:

Hook line  
Next line  
Next line  
Final CTA  

No paragraphs.

---------------------------------------------------
VARIATION RULES
---------------------------------------------------

You must write:

### Variation 1: Direct + Tactical
- More instructional
- Clear steps or framework
- Feels like actionable advice

### Variation 2: Story + Emotional
- Starts with a relatable scenario or personal story
- More dramatic tension
- Feels more cinematic and human

Both must deliver the same core idea but in totally different styles.

---------------------------------------------------
INPUTS
---------------------------------------------------

Selected Hook:
"{{HOOK}}"

Selected Idea:
"{{CONCEPT}}"

Target Audience:
"creators, founders, LinkedIn professionals, business owners"

Core Outcome:
"follow, comment, engage, rethink a belief"

---------------------------------------------------
YOUR TASK
---------------------------------------------------

1. Write Script Variation 1 (Direct + Tactical)
2. Write Script Variation 2 (Story + Emotional)

Make them punchy, scroll-stopping, and highly engaging.

IMPORTANT: Return the output as a JSON object with two keys:
- "variation1": The full script text for Variation 1 (Direct + Tactical). Use \\n for line breaks.
- "variation2": The full script text for Variation 2 (Story + Emotional). Use \\n for line breaks.

No explanations. No extra commentary. Just the JSON object.`;

// --------------- GET / SET HELPERS ---------------

export function getPrompt(key: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
}

export function setPrompt(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    if (value.trim()) {
        localStorage.setItem(key, value);
    } else {
        localStorage.removeItem(key);
    }
}

export function resetPrompt(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
}
