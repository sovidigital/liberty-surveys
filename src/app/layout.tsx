import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
