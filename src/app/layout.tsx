import type { Metadata, Viewport } from "next";
import "./globals.css";
import { buildAccentScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Avícola Don Ramón — Gestión de pollería",
  description:
    "Sistema de gestión para Avícola Don Ramón: productos, precios y stock.",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: buildAccentScript() }} />
        {children}
      </body>
    </html>
  );
}
