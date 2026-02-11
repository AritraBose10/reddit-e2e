import { NextRequest, NextResponse } from 'next/server';
import { getPostDetails } from '@/lib/reddit';
import { generateContentIdeas } from '@/lib/ai';
import { RedditPost } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { posts } = body;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json(
                { error: 'Invalid posts data provided.' },
                { status: 400 }
            );
        }

        // Limit to top 10 posts to avoid hitting rate limits and consuming too many tokens
        const topPosts = posts.slice(0, 10);
        const topic = topPosts[0].subreddit; // Use the subreddit of the first post as a loose topic proxy, or derive it

        console.log(`Analyzing ${topPosts.length} posts for topic: ${topic}`);

        // Fetch comments for these posts in parallel
        const postsData = await Promise.all(
            topPosts.map(async (post: RedditPost) => {
                // Extract permalink from link (e.g., https://www.reddit.com/r/foo/comments/bar/baz/ -> /r/foo/comments/bar/baz/)
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

        // Generate ideas using AI
        const ideas = await generateContentIdeas(topic, validDiscussions);

        return NextResponse.json({ ideas });
    } catch (error) {
        console.error('Error in analyze route:', error);
        return NextResponse.json(
            { error: 'Failed to generate ideas.' },
            { status: 500 }
        );
    }
}
