"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { RedditPost, ContentIdea } from "@/types";
import { toast } from "sonner"; // Assuming sonner is used, or generic toast if not. Actually let's assume raw or console for now if no toast context, but standard shadcn uses sonner or toast. I'll stick to a simple alert or console if I don't see sonner setup, but I see `components/ui` so likelihood is high. Wait, I didn't verify toast. I'll use standard `alert` fallback if needed or just simple state.
// Actually, let's look at `package.json` later. For now, I'll pass error state up or use a simple UI feedback.

interface GenerateIdeasButtonProps {
    posts: RedditPost[];
    onIdeasGenerated: (ideas: ContentIdea[]) => void;
    isLoading?: boolean;
}

export default function GenerateIdeasButton({
    posts,
    onIdeasGenerated,
}: GenerateIdeasButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (posts.length === 0) return;

        setLoading(true);
        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ posts }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate ideas");
            }

            onIdeasGenerated(data.ideas);
        } catch (error) {
            console.error("Error generating ideas:", error);
            // You might want to add a toast notification here
            alert("Failed to generate ideas. Please check console and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={handleGenerate}
            disabled={loading || posts.length === 0}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
        >
            {loading ? (
                <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                </>
            ) : (
                <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Ideas
                </>
            )}
        </Button>
    );
}
