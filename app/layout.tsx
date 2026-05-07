import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAISR",
  description:
    "Learning Authorship Integrity Signal Review for DOCX forensic signals and viva preparation."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
