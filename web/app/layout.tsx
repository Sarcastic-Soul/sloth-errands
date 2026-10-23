import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Motion } from "@/components/motion";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["500", "700", "800", "900"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Sloth Errands",
  description: "Chores that run overnight and wait for your OK on the risky step.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh">
        <Motion>{children}</Motion>
      </body>
    </html>
  );
}
