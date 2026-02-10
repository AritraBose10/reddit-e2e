/**
 * Client-side XLSX export using SheetJS.
 * Generates and downloads an Excel file with Reddit post data.
 */

import * as XLSX from 'xlsx';
import { RedditPost } from '@/types';

/**
 * Export Reddit posts to an XLSX file and trigger browser download.
 */
export function exportToXLSX(posts: RedditPost[], keywords: string): void {
    // Prepare data rows
    const data = posts.map((post) => ({
        Title: post.title,
        Subreddit: post.subreddit,
        Upvotes: post.upvotes,
        Comments: post.comments,
        Author: post.author,
        'Posted Date': new Date(post.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }),
        URL: post.link,
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths for readability
    worksheet['!cols'] = [
        { wch: 60 },  // Title
        { wch: 20 },  // Subreddit
        { wch: 10 },  // Upvotes
        { wch: 10 },  // Comments
        { wch: 18 },  // Author
        { wch: 15 },  // Posted Date
        { wch: 50 },  // URL
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reddit Posts');

    // Generate filename with sanitized keywords
    const sanitizedKeywords = keywords
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 30);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `reddit-search-${sanitizedKeywords}-${timestamp}.xlsx`;

    // Trigger browser download
    XLSX.writeFile(workbook, filename);
}
