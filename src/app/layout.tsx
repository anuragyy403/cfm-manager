import type { Metadata, Viewport } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import { APP_NAME, COMPANY_NAME } from "@/components/brand";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// One geometric face for everything, light at display sizes (see globals.css).
const sora = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `Team task tracking and management for ${COMPANY_NAME}`,
  // Installed to an iPhone home screen, open full screen like an app.
  appleWebApp: { capable: true, title: "CFM Work", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0c243e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
