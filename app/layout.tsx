import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
     <body className="min-h-screen bg-[#eef5fb]">   
        <div
          className="fixed inset-0 -z-10 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/sky2.jpg')" }}
        />
        <Navbar />{/* Global navbar */}
        {children}
     </body>
    </html>
  );
}