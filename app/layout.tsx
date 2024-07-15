import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVG To 3D",
  description: "Convert svg to 3d using three.js",
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
