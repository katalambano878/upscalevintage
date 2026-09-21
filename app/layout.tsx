import type { Viewport } from "next";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import {
  buildRootMetadata,
  organizationJsonLd,
  websiteJsonLd,
  localBusinessJsonLd,
  SEO_ASSETS,
} from "@/lib/seo";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111111',
};

export const metadata = buildRootMetadata();

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const structuredData = [organizationJsonLd(), websiteJsonLd(), localBusinessJsonLd()];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Upscale" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#111111" />
        <meta name="msapplication-TileImage" content={SEO_ASSETS.icon192} />
        <meta name="msapplication-config" content="/favicon/browserconfig.xml" />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="icon" href={SEO_ASSETS.faviconIco} sizes="any" />
        <link rel="icon" type="image/png" sizes="16x16" href={SEO_ASSETS.favicon16} />
        <link rel="icon" type="image/png" sizes="32x32" href={SEO_ASSETS.favicon32} />
        <link rel="apple-touch-icon" sizes="180x180" href={SEO_ASSETS.appleTouchIcon} />
        <link rel="manifest" href="/favicon/site.webmanifest" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var host = location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') return;
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function (regs) {
                    regs.forEach(function (reg) { reg.unregister(); });
                  });
                }
                if (window.caches) {
                  caches.keys().then(function (keys) {
                    keys.forEach(function (key) { caches.delete(key); });
                  });
                }
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap"
          rel="stylesheet"
        />

        {structuredData.map((schema) => (
          <script
            key={schema['@type'] as string}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>

      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className="antialiased font-sans overflow-x-hidden pwa-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-black focus:text-white focus:rounded-lg focus:font-semibold"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <div id="main-content">
                {children}
              </div>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
