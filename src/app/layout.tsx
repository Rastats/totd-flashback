import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DonationNotifications from "@/components/DonationNotifications";
import AuthProvider from "@/components/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TOTD Flashback - Trackmania Charity Marathon",
  description: "69-hour charity speedrun marathon celebrating TOTD #2000. December 21-24, 2025.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          <Header />
          <DonationNotifications />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

