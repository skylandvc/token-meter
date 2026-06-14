import CursorUsagePanel from "./cursor-usage-panel";

export default function CursorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local Cursor usage</p>
          <h1>Cursor Usage</h1>
        </div>
        <div className="account">
          <span>Cursorのagent transcriptから推定集計</span>
          <a className="button button--light" href="/">
            Dashboard
          </a>
          <a className="button button--light" href="/projects">
            Projects
          </a>
          <a className="button button--light" href="/threads">
            Chats
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
      <CursorUsagePanel />
    </main>
  );
}
