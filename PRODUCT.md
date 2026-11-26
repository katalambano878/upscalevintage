# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Shoppers:** mostly women in Ghana, Accra first. They find the shop on Instagram, Snapchat and WhatsApp, browse and buy on a phone, and pay with Mobile Money. Many check out as guests.
- **Shop team:** the owner plus a few staff. The owner manages products, orders, prices and sales. Cashiers use the in-store till (POS) and close the day (end-of-day), mostly on a phone or tablet.

## Product Purpose

Upscale Vintage is the online shop and in-store till for a curated lifestyle boutique in Accra. Shoppers browse, order and pay with Mobile Money, then pick up at the shop for free or get doorstep delivery (delivery cost is quoted after the order). Staff run the same catalog, stock and orders from one admin, for website orders and till sales alike.

Success means a shopper on a phone can find an item, pay with Mobile Money and know when to collect it without needing to message the shop, and the team can trust the stock and sales figures at the end of the day.

## Positioning

Hand-picked fashion, bags, beauty and home imports in one place, with trusted sourcing and pickup at the Hatso shop in Accra.

## Operating Context

- Shoppers arrive from social links and WhatsApp chats, usually on mobile data.
- Payment is Moolre Mobile Money, full payment only. Cash and card are taken only at the till.
- Store pickup: Hatso Agbogba Salasi Junction, Accra. Doorstep delivery is quoted by the team after the order.
- Customers hear from the shop by SMS (Taysend, with Moolre as fallback) and email (Resend). WhatsApp (054 503 5799) is the main support channel.
- Staff work in `/admin`: products and variants (size, colour), store-wide sale pricing, orders, payments reconciliation, POS, end-of-day, customers, coupons, reviews, blog, staff permissions, Buy SMS.

## Capabilities and Constraints

- Next.js 15 app with plain Postgres, hosted on the owner's VPS (Coolify, big-vps). Currency GHS (GH₵).
- Prices, stock and totals are set on the server; the browser never decides what is charged.
- Online orders and till sales are kept separate (`orders.channel`).
- Staff access is permission-based (admin vs staff presets).
- Not built yet: an admin view for replying to support tickets inside the app (tickets and returns are listed and emailed to the shop).
- No loyalty or referral programme exists. Do not show points or rewards.

## Brand Commitments

- Name: Upscale Vintage (short: Upscale). Tagline: "Good things. A brighter you."
- Existing look: black, white and gold. Treat it as the incumbent identity.
- Contact: Instagram @upscale_vintage12, Snapchat @upscalevintage2, WhatsApp 054 503 5799.

## Evidence on Hand

- Brand mark and logos in `public/` (`brand-mark.png`, `logo.png`, `logo-on-dark.png`).
- Hero and category photos in `public/hero/` and `public/categories/`.
- No customer testimonials, press, sales figures or ratings are on hand. Do not invent them.

## Product Principles

1. Phone first: every shopper task must work one-handed on a small screen over mobile data.
2. Never surprise at payment: the price shown is the price charged, and every error says what to do next.
3. One source of truth: stock, prices and orders stay consistent across website, till and admin.
4. Staff time is scarce: admin screens favour speed and clarity over decoration.
