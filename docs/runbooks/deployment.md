
# Vercel Deployment Guide

## Prerequisites

1.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com).
2.  **GitHub Repository**: Ensure your code is pushed to GitHub (already done).
3.  **Upstash Redis (Optional but Recommended)**: For persistent caching in serverless environments.

## Step-by-Step Deployment

1.  **Import to Vercel**:
    - Go to your Vercel Dashboard.
    - Click **"Add New..."** -> **"Project"**.
    - Select your repository (`AritraBose10/reddit-e2e`).
    - Framework Preset: **Next.js** (detected automatically).

2.  **Configure Environment Variables**:
    Add the following variables in the "Environment Variables" section:

    | Variable | Value (Example/Description) |
    | :--- | :--- |
    | `GROQ_API_KEY` | `gsk_your_actual_key_here` |
    | `HF_API_KEY` | `hf_your_actual_token_here` |
    | `NEXTAUTH_SECRET` | Generate a random string (e.g., `openssl rand -base64 32`) |
    | `NEXTAUTH_URL` | Your Vercel URL (e.g., `https://your-project.vercel.app`) |

    **For Production Caching (Highly Recommended):**
    Create a free Redis database at [upstash.com](https://upstash.com) and add:
    
    | Variable | Value |
    | :--- | :--- |
    | `UPSTASH_REDIS_REST_URL` | From Upstash Details |
    | `UPSTASH_REDIS_REST_TOKEN` | From Upstash Details |

    *Without Redis, caching will only work per-request or for very short durations, slowing down the app.*

3.  **Deploy**:
    - Click **"Deploy"**.
    - Wait for the build to complete.

## Post-Deployment

1.  **Verify Functionality**:
    - Test the search feature.
    - Check if "Semantic Filter" is working (might be slower on cold starts).

2.  **Troubleshooting**:
    - **Timeout Errors**: If searches take >10s, Vercel's free tier might time out. The current code has timeouts set to 8s-20s, which is within limits but close.
    - **Rate Limits**: If you see 429 errors, Reddit is limiting the shared IP. Redis caching helps mitigate this significantly.

## Production Code Changes

No major code changes are required. The current codebase is "Serverless Ready":
- ✅ **Server-Side Fetching**: Hides API keys.
- ✅ **Stateless Auth**: Uses NextAuth.js (JWT).
- ✅ **External Caching**: Ready for Redis.
