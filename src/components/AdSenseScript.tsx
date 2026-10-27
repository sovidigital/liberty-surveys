import Script from 'next/script';

const PUBLISHER_ID = 'ca-pub-1375050605480919';

export function AdSenseScript() {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
