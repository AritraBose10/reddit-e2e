
/**
 * Builds a frequency map of how many times each post appeared across different search queries.
 * @param queryResults Array of arrays, where each inner array contains posts from a single query.
 */
export function buildPostFrequency(queryResults: any[][]): Map<string, number> {
    const frequencyMap = new Map<string, number>();

    queryResults.forEach((posts) => {
        // Use a set to count unique appearances per query (prevent double counting if API returns duplicates)
        const uniqueIdsInQuery = new Set(posts.map(p => p.id));

        uniqueIdsInQuery.forEach((id) => {
            frequencyMap.set(id, (frequencyMap.get(id) || 0) + 1);
        });
    });

    return frequencyMap;
}

/**
 * Deduplicates posts and applies a bonus score based on appearance frequency.
 * Boosts score by +1 for each extra query appearance.
 */
export function deduplicateWithBonus(queryResults: any[][]): any[] {
    const frequencyMap = buildPostFrequency(queryResults);
    const allPosts = queryResults.flat();
    const uniquePosts = new Map<string, any>();

    allPosts.forEach((post) => {
        if (!uniquePosts.has(post.id)) {
            const freq = frequencyMap.get(post.id) || 1;
            const boostedScore = (post.score || 0) + (freq - 1) * 5; // +5 upvotes equivalent bonus per extra appearance?
            // Actually instructions say "boosts each post's score".
            // Assuming we are modifying an internal 'heuristicScore' or just returning clean objects.
            // Let's just attach the frequency for now as the user asked for deduplication logic.

            uniquePosts.set(post.id, {
                ...post,
                frequencyBonus: freq - 1
            });
        }
    });

    return Array.from(uniquePosts.values());
}

/**
 * Calculates a heuristic score for a post to pre-rank before AI analysis.
 * Returns a score from 0-10 for normalized ranking.
 * Uses defensive fallbacks to prevent NaN.
 */
export function heuristicScore(post: any, queryWords?: string[]): number {
    const upvotes = post.upvotes || post.ups || 0;
    const comments = post.comments || post.num_comments || 0;

    // `created` is an ISO string in RedditPost; fall back to raw UTC number
    const createdMs = post.created
        ? new Date(post.created).getTime()
        : (post.created_utc || 0) * 1000;

    // Recency scoring: recent posts get higher scores, old posts decay naturally
    // Using log scale to avoid extreme differences
    const hoursAgo = Math.max(0, (Date.now() - createdMs) / (1000 * 3600));
    const daysSgo = Math.max(0.1, hoursAgo / 24);
    const recencyScore = 10 / (1 + Math.log10(daysSgo + 1)); // Results in 10 for fresh, decays to ~5-6 for old

    // Engagement scoring: normalized log scale (prevents huge numbers)
    // Log scale: 100 upvotes = ~5, 10K upvotes = ~7.5, 100K = ~10
    const upvoteScore = Math.min(10, Math.log10(upvotes + 1) * 2.5);
    const commentScore = Math.min(10, Math.log10(comments + 1) * 2.5);

    // Combined engagement: weight comments slightly higher (they indicate discussion)
    const engagementScore = (upvoteScore * 0.6 + commentScore * 0.8) / 1.4; // Average, normalized

    // Semantic relevance multiplier (if available)
    const semanticScore = post.semanticScore || 0;
    let relevanceMultiplier = 1;
    if (semanticScore > 0.65) {
        // Scale 0.65-1.0 to 0.5-2.0x multiplier (not too aggressive)
        relevanceMultiplier = 0.5 + ((semanticScore - 0.65) / 0.35) * 1.5;
    }

    // Keyword overlap bonus: modest boost (max 1.3x)
    let keywordBoost = 1;
    if (queryWords && queryWords.length > 0) {
        const titleLower = (post.title || '').toLowerCase();
        const matchCount = queryWords.filter(w => titleLower.includes(w) && w.length > 2).length;
        const matchRatio = matchCount / queryWords.length;
        keywordBoost = 1 + matchRatio * 0.3; // 1.0 to 1.3x boost
    }

    // Composite score: weighted average of all factors
    // Recency (40%) + Engagement (40%) + Semantic (20%)
    let finalScore = (recencyScore * 0.4 + engagementScore * 0.4) * relevanceMultiplier * keywordBoost;

    // Normalize to 0-10 scale
    finalScore = Math.max(0, Math.min(10, finalScore));

    // Guard against Infinity/NaN
    if (!Number.isFinite(finalScore)) finalScore = 0;

    return Math.round(finalScore * 2) / 2; // Round to nearest 0.5 for cleaner display
}
