import LocalUsagePanel from "./local-usage-panel";
import ManualPlanSettings from "./manual-plan-settings";
import PwaInstallButton from "./pwa-install-button";

const DESKTOP_DOWNLOAD_URL = "https://github.com/skylandvc/token-meter/releases/tag/desktop-v0.1.0";

function Dashboard() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Operations console</p>
          <h1>Token Meter</h1>
        </div>
        <div className="account">
          <span>ログインなしで利用できます</span>
          <PwaInstallButton />
          <a
            className="button"
            href={DESKTOP_DOWNLOAD_URL}
            rel="noreferrer"
            target="_blank"
          >
            DL版アプリ
          </a>
          <a
            className="button button--light"
            href="/projects"
          >
            プロジェクト別
          </a>
          <a
            className="button button--light"
            href="/threads"
          >
            チャット別
          </a>
          <a
            className="button button--light"
            href="/cursor"
          >
            Cursor
          </a>
          <a
            className="text-link"
            href="https://github.com/skylandvc/token-meter"
            rel="noreferrer"
            target="_blank"
          >
            README
          </a>
        </div>
      </header>

      <LocalUsagePanel />
      <ManualPlanSettings />
    </main>
  );
}

export default function Page() {
  return <Dashboard />;
}
