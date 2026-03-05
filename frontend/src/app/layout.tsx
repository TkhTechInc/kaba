import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s | Kaba",
    default: "Kaba",
  },
  description: "MSME accounting SaaS for West Africa.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kaba",
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: "#5750F1",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />
          {children}
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var isLocalhost = window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1';
                var swEnabledOnLocalhost = '${process.env.NEXT_PUBLIC_ENABLE_SW_LOCALHOST || ""}' === 'true';
                if (isLocalhost && !swEnabledOnLocalhost) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.warn('SW registration failed:', err);
                    });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
