import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

// One family; weight carries importance (Part 1 §4).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Retainer delivery tracker",
  description: "Which retained creators have filmed this week's videos, and which haven't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
