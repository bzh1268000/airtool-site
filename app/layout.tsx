import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "./components/navbar";

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
          /* Hide Google Translate banner/toolbar */
          .goog-te-banner-frame, .skiptranslate { display: none !important; }
          body { top: 0 !important; }
          .goog-te-gadget { font-size: 0 !important; }
        `}</style>
      </head>
      <body className="min-h-screen bg-[#eef5fb]">
        {/* Hidden Google Translate mount point */}
        <div id="google_translate_element" style={{ display: "none" }} />

        <div
          className="fixed inset-0 -z-10 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/sky2.jpg')" }}
        />
        <Navbar />
        {children}

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
