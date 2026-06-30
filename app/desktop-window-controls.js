"use client";

import { useEffect, useState } from "react";

export default function DesktopWindowControls() {
  const [available, setAvailable] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    const desktop = window.tokenMeterDesktop;
    if (!desktop) return;

    setAvailable(true);
    desktop.getAlwaysOnTop?.().then((value) => setAlwaysOnTop(Boolean(value))).catch(() => {});
  }, []);

  async function toggleAlwaysOnTop() {
    const desktop = window.tokenMeterDesktop;
    if (!desktop) return;

    const nextValue = !alwaysOnTop;
    setAlwaysOnTop(nextValue);
    try {
      const result = await desktop.setAlwaysOnTop(nextValue);
      setAlwaysOnTop(Boolean(result));
    } catch {
      setAlwaysOnTop(!nextValue);
    }
  }

  return (
    <button
      className={`button button--light window-pin${alwaysOnTop ? " window-pin--active" : ""}`}
      disabled={!available}
      onClick={toggleAlwaysOnTop}
      title={available ? "DL版アプリを常に最前面に表示します" : "常に最前面はDL版アプリで使えます"}
      type="button"
    >
      {alwaysOnTop ? "最前面中" : "最前面"}
    </button>
  );
}
