import "./globals.css";
import PwaServiceWorker from "./pwa-service-worker";

export const metadata = {
  title: "Token Meter",
  description: "Codex / Claude Code / Cursor のローカルトークン使用量を確認するダッシュボードです。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Token Meter",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#1a2332",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
