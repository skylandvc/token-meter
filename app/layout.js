import "./globals.css";

export const metadata = {
  title: "Token Meter",
  description: "Authenticated token usage dashboard for Codex and Claude Code.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
