# Deployment Guide - Vercel

## Prerequisites
- GitHub account with this repository pushed
- Vercel account (free at https://vercel.com)

## Step 1: Push to GitHub

```bash
# Initialize/update git repository
git remote add origin https://github.com/YOUR_USERNAME/reddit-scraper.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Vercel Dashboard (Easiest)
1. Go to https://vercel.com/new
2. Select "Next.js" project type
3. Import your GitHub repository
4. Vercel will auto-detect Next.js settings
5. Click "Deploy"

### Option B: Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

## Step 3: Configure Environment Variables

After initial deployment, add these variables in Vercel Dashboard:

**Project Settings → Environment Variables**

```
GROQ_API_KEY = your_groq_api_key_here
HF_API_KEY = your_huggingface_api_key_here
GOOGLE_CLIENT_ID = your_google_client_id
GOOGLE_CLIENT_SECRET = your_google_client_secret
NEXTAUTH_SECRET = (generate a random secret with: openssl rand -base64 32)
NEXTAUTH_URL = https://your-domain.vercel.app
GOOGLE_REDIRECT_URI = https://your-domain.vercel.app/api/google/auth/callback
```

## Step 4: Update Configuration Files

After deployment, update these with your actual domain:

**Production Environment (.env.production)**
- Update `NEXTAUTH_URL` with your Vercel domain
- Update `GOOGLE_REDIRECT_URI` with your Vercel domain

**Example:**
```
NEXTAUTH_URL=https://reddit-scraper-abc123.vercel.app
GOOGLE_REDIRECT_URI=https://reddit-scraper-abc123.vercel.app/api/google/auth/callback
```

## Step 5: Verify Deployment

1. Visit your Vercel domain (e.g., https://reddit-scraper-abc123.vercel.app)
2. Test the main search functionality
3. Test Context Mode (if all APIs are configured)
4. Check browser console for any errors

## Troubleshooting

### 502/500 Errors
- Check Vercel logs: `vercel logs`
- Verify all environment variables are set
- Ensure GROQ_API_KEY and HF_API_KEY are valid

### Google OAuth Not Working
- Verify `GOOGLE_REDIRECT_URI` matches Vercel domain exactly
- Update Google OAuth app settings with new Vercel domain

### Serverless Function Timeout
- Reddit search may timeout on slow networks
- This is OK; graceful fallback is in place

## Production Checklist

- [ ] Git repository pushed to GitHub
- [ ] Vercel project created and connected
- [ ] All environment variables configured
- [ ] NEXTAUTH_URL points to Vercel domain
- [ ] GOOGLE_REDIRECT_URI updated for OAuth
- [ ] Tested Reddit search functionality
- [ ] Tested Context Mode (if HF_API_KEY configured)
- [ ] Verified no console errors

## Performance Tips

1. **Redeploy after fixes:**
   ```bash
   git push origin main
   # Vercel auto-deploys on push
   ```

2. **Monitor function execution:**
   - Dashboard → Analytics → Serverless Functions
   - Check for slow or failing endpoints

3. **API Usage:**
   - Reddit: Public API (no key needed, rate limited)
   - Groq: Check usage at https://console.groq.com
   - HuggingFace: Check usage at https://huggingface.co/settings/billing

## Rollback

If you need to revert to a previous deployment:
1. Go to Vercel Dashboard → Deployments
2. Find the working deployment
3. Click "Promote to Production"

## Custom Domain (Optional)

1. Vercel Dashboard → Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update environment variables with custom domain

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **GitHub Issues:** For bugs in the application code
