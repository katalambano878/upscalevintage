# Customization Checklist

Complete these steps to make this project fully yours.

## Identity

- [ ] Replace `YOUR_PROJECT_NAME` everywhere
- [ ] Replace `YOUR_APP_TITLE` / `YOUR_BRAND_NAME` / `YOUR_SHORT_NAME` everywhere
- [ ] Replace `yourdomain.com` everywhere
- [ ] Replace `YOUR_NAME` and `your@email.com` everywhere
- [ ] Update `package.json` — name, description, author, homepage, repository
- [ ] Update `lib/brand.ts` with your canonical brand constants (optional but recommended)

## Assets (see `/public/ASSETS_GUIDE.md`)

- [ ] Add `/public/favicon.ico`
- [ ] Add `/public/apple-touch-icon.png`
- [ ] Add `/public/icon-192.png` and `/public/icon-512.png`
- [ ] Replace `/public/logo.svg` with your brand logo
- [ ] Add `/public/og-image.png` (1200×630px)
- [ ] Add `/public/hero.jpg` and wire hero slides in `app/(store)/page.tsx`
- [ ] Replace `components/Logo.tsx` or use your logo asset

## Configuration

- [ ] Copy `.env.example` → `.env.local` and fill all values
- [ ] Update `public/manifest.json` with your app name and colors
- [ ] Set up your Supabase project (`YOUR_PROJECT_ID`) and update connection strings
- [ ] Configure payment provider keys (Moolre / Paystack / etc.)
- [ ] Configure Resend (or email provider) + `EMAIL_FROM` / `ADMIN_EMAIL`
- [ ] Add analytics ID: `NEXT_PUBLIC_GA_MEASUREMENT_ID`

## Legal & content

- [ ] Replace `/LICENSE` with your chosen license
- [ ] Update `app/(store)/privacy/page.tsx` with your privacy policy
- [ ] Update `app/(store)/terms/page.tsx` with your terms of service
- [ ] Update contact details in `context/CMSContext.tsx` defaults

## SEO

- [ ] Update `public/robots.txt` sitemap URL
- [ ] Update `app/sitemap.ts` and `app/robots.ts` base URL
- [ ] Update Open Graph metadata in `app/layout.tsx`

## Deployment

- [ ] Configure `vercel.json` / hosting platform
- [ ] Set environment variables in Vercel/Netlify
- [ ] Connect your custom domain

## Repository

- [ ] Initialize git with your remote: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git`
- [ ] Remove any `.vercel` folder linked to a previous project before deploying
