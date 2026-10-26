import type { Metadata } from "next";
import "./globals.css";
import { FontAwesomeConfig } from "@/components/FontAwesomeConfig";
import { AdSenseScript } from "@/components/AdSenseScript";

export const metadata: Metadata = {
  title: "Liberty Surveys - Daily Political Polls",
  description: "Join thousands of Americans sharing their views on the issues that matter most. Subscribe to receive daily political polls directly in your inbox.",
  keywords: ["political polls", "surveys", "public opinion", "current events", "democracy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <AdSenseScript />
      </head>
      <body className="antialiased bg-gray-50 min-h-screen">
        <FontAwesomeConfig />
        {children}
      </body>
    </html>
  );
}
