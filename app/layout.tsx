import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "./providers/AuthProvider";
import { Toaster } from "./components/ui/toaster";
import ErrorBoundary from "./components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Study Assistant",
  description: "An intelligent study assistant powered by AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
