import LocalUsagePanel from "./local-usage-panel";

const CONTRACTS = [
  {
    service: "Claude Code",
    plan: "Pro",
    price: "$20 / month",
    renewal: "未設定",
    tone: "claude",
  },
  {
    service: "Codex",
    plan: "Plus",
    price: "$20 / month",
    renewal: "未設定",
    tone: "codex",
  },
];

function ContractPanel({ contract }) {
  return (
    <article className={`pricing-panel pricing-panel--${contract.tone}`}>
      <div className="pricing-panel__head">
        <div>
          <p className="eyebrow">{contract.service}</p>
          <h2>My Plan & Price</h2>
        </div>
        <span>確認日 2026-06-05</span>
      </div>
      <div className="pricing-row pricing-row--current">
        <div>
          <span>{contract.service}</span>
          <strong>{contract.plan}</strong>
          <em>次回更新日 {contract.renewal}</em>
        </div>
        <b>{contract.price}</b>
      </div>
      <p className="pricing-note">現在の契約として表示しています。</p>
    </article>
  );
}

function Dashboard() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Public dashboard</p>
          <h1>Token Meter</h1>
        </div>
        <div className="account">
          <span>ログインなしで利用できます</span>
          <a
            className="button button--light"
            href="/"
          >
            トップページ
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

      <section className="pricing-grid" aria-label="契約中プラン">
          {CONTRACTS.map((contract) => (
            <ContractPanel key={contract.service} contract={contract} />
          ))}
      </section>
    </main>
  );
}

export default function Page() {
  return <Dashboard />;
}
