import type { Metadata } from "next";
import { Inter, Archivo } from "next/font/google";
import { Toaster } from "sonner";
import { AgentationOverlay } from "@/components/agentation";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "TechBBQ Visual Generator",
  description: "Generate branded social media visuals for TechBBQ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${archivo.variable} antialiased`}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f2f2f2",
            },
          }}
        />
        <AgentationOverlay />
      </body>
    </html>
  );
}
