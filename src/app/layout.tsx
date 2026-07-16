import type { Metadata } from "next";
import { Montserrat, DM_Sans } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";

// ─── CONFIGURAÇÃO DAS FONTES OFICIAIS CLEAN & CLINICAL ───
const fontTitle = Montserrat({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const fontBody = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Luarys",
  description: "Onde gestão de excelência encontra resultado real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${fontTitle.variable} ${fontBody.variable} antialiased`}>
        {/* Removemos o AuthProvider daqui, pois o page.tsx já faz a segurança! */}
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}