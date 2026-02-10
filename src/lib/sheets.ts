/**
 * Google Sheets API helpers.
 * Handles OAuth URL generation, token exchange, and spreadsheet creation.
 */

import { google } from 'googleapis';
import { RedditPost, GoogleAuthTokens } from '@/types';
import crypto from 'crypto';

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Create an OAuth2 client with credentials from env vars.
 */
function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/auth/callback'
    );
}

/**
 * Generate the Google OAuth consent URL.
 */
export function getAuthUrl(): string {
    const oauth2Client = getOAuth2Client();
    const state = crypto.randomBytes(16).toString('hex');

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state,
        prompt: 'consent',
    });
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleAuthTokens> {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    return {
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        expiry_date: tokens.expiry_date || 0,
        email: userInfo.data.email || undefined,
    };
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleAuthTokens> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
        access_token: credentials.access_token || '',
        refresh_token: refreshToken,
        expiry_date: credentials.expiry_date || 0,
    };
}

/**
 * Encrypt tokens for secure cookie storage.
 */
export function encryptTokens(tokens: GoogleAuthTokens): string {
    const key = process.env.NEXTAUTH_SECRET || 'default-secret-change-me-now!!!';
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt tokens from cookie.
 */
export function decryptTokens(encryptedData: string): GoogleAuthTokens | null {
    try {
        const key = process.env.NEXTAUTH_SECRET || 'default-secret-change-me-now!!!';
        const keyBuffer = crypto.scryptSync(key, 'salt', 32);
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

/**
 * Create a new Google Sheet with Reddit post data.
 * Returns the spreadsheet URL.
 */
export async function createSpreadsheet(
    tokens: GoogleAuthTokens,
    posts: RedditPost[],
    keywords: string
): Promise<string> {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    // Create the spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
            properties: {
                title: `Reddit Search - ${keywords} - ${date}`,
            },
        },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;

    // Prepare data rows
    const headers = ['Title', 'Subreddit', 'Upvotes', 'Comments', 'Author', 'Posted Date', 'URL'];
    const rows = posts.map((post) => [
        post.title,
        post.subreddit,
        post.upvotes,
        post.comments,
        post.author,
        new Date(post.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }),
        post.link,
    ]);

    // Batch update — write headers + data in one call
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
            data: [
                {
                    range: 'Sheet1!A1:G1',
                    values: [headers],
                },
                {
                    range: `Sheet1!A2:G${posts.length + 1}`,
                    values: rows,
                },
            ],
            valueInputOption: 'RAW',
        },
    });

    // Format the header row (bold + freeze)
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    repeatCell: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 0,
                            endRowIndex: 1,
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: { red: 0.2, green: 0.2, blue: 0.3 },
                            },
                        },
                        fields: 'userEnteredFormat(textFormat,backgroundColor)',
                    },
                },
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: 0,
                            gridProperties: { frozenRowCount: 1 },
                        },
                        fields: 'gridProperties.frozenRowCount',
                    },
                },
            ],
        },
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
