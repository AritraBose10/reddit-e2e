import { NextRequest, NextResponse } from 'next/server';
import { getPostDetails } from '@/lib/reddit';
import { generateContentIdeas, generateViralHooks } from '@/lib/ai';
import { RedditPost } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { posts, ideasPrompt, hooksPrompt } = body;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json(
                { error: 'Invalid posts data provided.' },
                { status: 400 }
            );
        }

        // Limit to top 10 posts to avoid hitting rate limits and consuming too many tokens
        const topPosts = posts.slice(0, 10);
        const topic = topPosts[0].subreddit;

        console.log(`Analyzing ${topPosts.length} posts for topic: ${topic}`);

        // Fetch comments for these posts in parallel
        const postsData = await Promise.all(
            topPosts.map(async (post: RedditPost) => {
                const permalink = post.link.replace('https://www.reddit.com', '');
                const comments = await getPostDetails(permalink);

                return `
                Title: ${post.title}
                Subreddit: ${post.subreddit}
                Upvotes: ${post.upvotes}
                Comments:
                ${comments}
                `;
            })
        );

        // Filter out empty results
        const validDiscussions = postsData.filter(text => text.trim().length > 0);

        if (validDiscussions.length === 0) {
            return NextResponse.json(
                { error: 'Could not fetch details for selected posts.' },
                { status: 500 }
            );
        }

        // Generate ideas and viral hooks in parallel
        const [rawIdeas, hooks] = await Promise.all([
            generateContentIdeas(topic, validDiscussions, ideasPrompt || undefined),
            generateViralHooks(validDiscussions, hooksPrompt || undefined),
        ]);

        // Distribute hooks across ideas (2 per idea)
        const ideas = rawIdeas.map((idea, i) => {
            const startIdx = i * 2;
            const ideaHooks = hooks.slice(startIdx, startIdx + 2);
            return { ...idea, hooks: ideaHooks };
        });

        return NextResponse.json({ ideas });
    } catch (error) {
        console.error('Error in analyze route:', error);
        return NextResponse.json(
            { error: 'Failed to generate ideas.' },
            { status: 500 }
        );
    }
}
