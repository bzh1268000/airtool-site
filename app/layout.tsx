import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "./components/navbar";
import { CartProvider } from "./context/CartContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AirTool",
  description: "Local tool sharing platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style>{`
          /* Hide all Google Translate UI chrome */
          .goog-te-banner-frame,
          .skiptranslate,
          .goog-te-gadget,
          .goog-te-spinner,
          #goog-gt-tt,
          .goog-tooltip,
          .goog-tooltip-content,
          .VIpgJd-ZVi9od-aZ2wEe-OiiCO,
          .VIpgJd-ZVi9od-aZ2wEe,
          .VIpgJd-yAWNEb-hvhgNd,
          .VIpgJd-yAWNEb-hvhgNd-IuizWc { display: none !important; }
          body { top: 0 !important; }
        `}</style>
      </head>
      <body className="min-h-screen bg-[#eef5fb]">
        {/* Hidden Google Translate mount point */}
        <div id="google_translate_element" style={{ display: "none" }} />

        <div
          className="fixed inset-0 -z-10 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/sky2.jpg')" }}
        />
        <CartProvider>
          <Navbar />
          {children}
        </CartProvider>

        <Script
          id="google-translate-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.googleTranslateElementInit = function() {
                new window.google.translate.TranslateElement(
                  { pageLanguage: 'en', autoDisplay: false },
                  'google_translate_element'
                );
              };
            `,
          }}
        />
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
