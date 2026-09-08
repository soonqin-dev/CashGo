import "./globals.css";

export const metadata = {
  title: "CashGo",
  description: "A simple mobile-first personal finance tracker",
  applicationName: "CashGo",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
