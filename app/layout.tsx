import "./globals.css";

export const metadata = {
  title: "CashGo",
  description: "Personal cash flow tracker",
  applicationName: "CashGo",
  appleWebApp: { capable: true, title: "CashGo", statusBarStyle: "black-translucent" as const },
  icons: { icon: "/icon.svg", apple: "/icon.svg" }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-Hans"><body>{children}</body></html>;
}
