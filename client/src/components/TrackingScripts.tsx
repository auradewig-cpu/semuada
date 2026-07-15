"use client";

import Script from 'next/script';
import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function TrackingScripts() {
  const { data: settings } = useSettings();

  const fbPixelId = settings?.facebook_pixel_id;
  const gaId = settings?.google_analytics_id;

  useEffect(() => {
    if (fbPixelId && !window.fbq) {
      (function (f: any, b: Document, e: string, v: string, n: any, t: any, s: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', undefined, undefined, undefined);

      (window as any).fbq('init', fbPixelId);
      (window as any).fbq('track', 'PageView');
    }
  }, [fbPixelId]);

  return (
    <>
      {gaId && (
        <>
          <Script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}

      {fbPixelId && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  );
}
