"use client";

export default function ReloadButton() {
  function reloadPage() {
    window.location.reload();
  }

  return (
    <button className="button button--light" onClick={reloadPage} type="button">
      リロード
    </button>
  );
}
