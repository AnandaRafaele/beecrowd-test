import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";

export const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
