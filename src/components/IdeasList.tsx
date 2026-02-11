"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Sparkles, Check, Lightbulb, Target, Megaphone } from "lucide-react";
import { useState } from "react";
import { ContentIdea } from "@/types";
import { Badge } from "@/components/ui/badge";

interface IdeasListProps {
    ideas: ContentIdea[];
}

export default function IdeasList({ ideas }: IdeasListProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = async (idea: ContentIdea, index: number) => {
        const text = `Hook: ${idea.hook}\nConcept: ${idea.concept}\nWhy: ${idea.why}\nCTA: ${idea.cta}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    if (!ideas || ideas.length === 0) return null;

    return (
        <div className="mt-8 space-y-6">
            <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                    <Sparkles className="h-6 w-6 text-violet-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Generated Content Ideas</h2>
                    <p className="text-muted-foreground">AI-curated video concepts based on your search.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {ideas.map((idea, index) => (
                    <Card key={index} className="group relative border-violet-500/10 hover:border-violet-500/30 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-card to-violet-500/5">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-4">
                                <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-200 mb-2">
                                    Idea #{index + 1}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyToClipboard(idea, index)}
                                >
                                    {copiedIndex === index ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">Copy idea</span>
                                </Button>
                            </div>
                            <CardTitle className="text-lg leading-tight font-bold text-foreground/90">
                                "{idea.hook}"
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-violet-600 font-medium text-xs uppercase tracking-wide">
                                    <Lightbulb className="h-3 w-3" /> Concept
                                </div>
                                <p className="text-muted-foreground leading-relaxed">{idea.concept}</p>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-amber-600 font-medium text-xs uppercase tracking-wide">
                                    <Target className="h-3 w-3" /> Why It Works
                                </div>
                                <p className="text-muted-foreground leading-relaxed">{idea.why}</p>
                            </div>

                            <div className="pt-2 border-t border-border/50 mt-2">
                                <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs uppercase tracking-wide mb-1">
                                    <Megaphone className="h-3 w-3" /> CTA
                                </div>
                                <p className="font-medium text-foreground">{idea.cta}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
