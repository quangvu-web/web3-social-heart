window.__FUN_PROFILE_APP_BOOTSTRAP_STARTED__ = true;

const rootElement = document.getElementById("root");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }
  return String(error ?? "");
}

function isRecoverableWalletExtensionError(error: unknown) {
  const text = getErrorText(error);
  const fromBrowserExtension = /chrome-extension:|moz-extension:|safari-web-extension:|inpage\.js/i.test(text);
  const walletNoise = /failed to connect to metamask|metamask|walletconnect|ethereum provider/i.test(text);
  return fromBrowserExtension && walletNoise;
}

function renderBootstrapFailure(error: unknown) {
  if (isRecoverableWalletExtensionError(error)) {
    console.warn("[FUN Profile] Ignored wallet extension bootstrap noise", error);
    return;
  }

  console.error("[FUN Profile] App bootstrap failed", error);
  window.__FUN_PROFILE_APP_RECOVERY_RENDERED__ = true;

  if (!rootElement) return;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown bootstrap error";

  const stack = error instanceof Error && error.stack ? error.stack : undefined;

  const details = escapeHtml(
    JSON.stringify(
      {
        code: "app_bootstrap_import_failed",
        message,
        stack,
        url: window.location.href,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f2f5;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 20px 50px rgba(15,23,42,.12)">
        <h1 style="margin:0 0 10px;font-size:22px;color:#111827">Không thể tải FUN Profile</h1>
        <p style="margin:0 0 18px;color:#4b5563;line-height:1.55">Ứng dụng có thể vừa được cập nhật hoặc kết nối đang gặp sự cố.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button onclick="window.location.reload()" style="border:0;border-radius:999px;background:#16a34a;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer">Tải lại ứng dụng</button>
          <button onclick="(async function(){try{if(navigator.serviceWorker){var r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(function(x){return x.unregister()}))}if(window.caches){var k=await caches.keys();await Promise.all(k.map(function(x){return caches.delete(x)}))}}finally{window.location.reload()}})()" style="border:1px solid #d1d5db;border-radius:999px;background:#fff;color:#111827;padding:10px 14px;font-weight:700;cursor:pointer">Xóa cache và tải lại</button>
        </div>
        <details style="margin-top:18px;color:#6b7280;font-size:12px">
          <summary>Chi tiết lỗi</summary>
          <pre style="white-space:pre-wrap;word-break:break-word;background:#f9fafb;border-radius:10px;padding:10px">${details}</pre>
        </details>
      </div>
    </div>`;
}

if (!rootElement) {
  renderBootstrapFailure(new Error("Missing #root element"));
} else {
  // Use a static import so Vite/Rollup manage the dependency graph correctly.
  // The dynamic /assets/app-bootstrap.js path was fragile after deploy and
  // could produce "Cannot access '_' before initialization" runtime errors.
  import("./bootstrap")
    .then(() => {
      if (!window.__FUN_PROFILE_APP_MOUNTED__ && !window.__FUN_PROFILE_APP_RECOVERY_RENDERED__) {
        renderBootstrapFailure(new Error("App bootstrap loaded but did not mount"));
      }
    })
    .catch(renderBootstrapFailure);
}

// Global safety net: catch any uncaught error before React mounts.
window.addEventListener("error", (event) => {
  if (window.__FUN_PROFILE_APP_MOUNTED__ || window.__FUN_PROFILE_APP_RECOVERY_RENDERED__) return;
  const error = event.error || new Error(event.message || "Unknown window error");
  if (isRecoverableWalletExtensionError(error)) {
    event.preventDefault();
    console.warn("[FUN Profile] Ignored wallet extension window error", error);
    return;
  }
  renderBootstrapFailure(error);
});

window.addEventListener("unhandledrejection", (event) => {
  if (window.__FUN_PROFILE_APP_MOUNTED__ || window.__FUN_PROFILE_APP_RECOVERY_RENDERED__) return;
  const reason = event.reason;
  const error = reason instanceof Error ? reason : new Error(String(reason));
  if (isRecoverableWalletExtensionError(error)) {
    event.preventDefault();
    console.warn("[FUN Profile] Ignored wallet extension rejection", error);
    return;
  }
  renderBootstrapFailure(error);
});
