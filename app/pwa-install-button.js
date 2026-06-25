"use client";

import { useEffect, useState } from "react";

const INSTALL_HELP_URL = "https://github.com/skylandvc/token-meter#アプリとしてインストール";

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
    setInstalled(Boolean(standalone));

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (installed) {
    return <span className="install-status">ブラウザアプリで起動中</span>;
  }

  if (installPrompt) {
    return (
      <button className="button button--light" onClick={installApp} type="button">
        ブラウザに追加
      </button>
    );
  }

  return (
    <a className="button button--light" href={INSTALL_HELP_URL} rel="noreferrer" target="_blank">
      ブラウザに追加
    </a>
  );
}
