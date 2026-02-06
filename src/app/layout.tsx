import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Player X Judge - Beyblade X Tournament Management",
  description: "Professional Beyblade X tournament management system",
  icons: {
    icon: "/assets/favicon.webp",
    shortcut: "/assets/favicon.webp",
    apple: "/assets/favicon.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}