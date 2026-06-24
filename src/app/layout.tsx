import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intelligent Order Processing System",
  description: "AI-native order processing backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
