import ProjectUsagePanel from "./project-usage-panel";

export default function ProjectsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local project usage</p>
          <h1>Project Tokens</h1>
        </div>
        <div className="account">
          <span>このPCのローカルログをプロジェクト別に集計</span>
          <a className="button button--light" href="/">
            Dashboard
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
      <ProjectUsagePanel />
    </main>
  );
}
