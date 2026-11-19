import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const appInstalled = () => { setInstalled(true); setHelp(false); };
    const checkMode = () => setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    checkMode();
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!promptEvent) { setHelp(true); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", zIndex: 1000, bottom: "max(16px, env(safe-area-inset-bottom))", left: 16, right: 16, display: "grid", justifyItems: "center", gap: 8, pointerEvents: "none" }}>
      {help && <section role="dialog" aria-label="راهنمای نصب سارینا" style={{ pointerEvents: "auto", width: "min(440px, 100%)", boxSizing: "border-box", background: "#fff", color: "#173f35", border: "1px solid #dce8dd", borderRadius: 16, padding: 16, boxShadow: "0 8px 32px #173f3526", lineHeight: 1.9, fontSize: 13 }}>
        <button onClick={() => setHelp(false)} aria-label="بستن" style={{ float: "left", border: 0, background: "transparent", color: "#173f35", fontSize: 18 }}>×</button>
        <strong>نصب سارینا روی گوشی</strong>
        <p>اگر گزینه «نصب برنامه» نمایش داده نمی‌شود، فعلاً Chrome فقط امکان افزودن میان‌بر را برای این سایت فراهم کرده است. این موضوع را با نصب واقعی اشتباه نگیرید.</p>
        <p>در Chrome منوی سه‌نقطه را باز کنید و در صورت وجود، «Install app» را انتخاب کنید. در iPhone از Safari، گزینه Share و سپس Add to Home Screen را بزنید.</p>
      </section>}
      <button onClick={install} style={{ pointerEvents: "auto", border: 0, borderRadius: 999, padding: "13px 20px", background: "#173f35", color: "#fff", fontWeight: 700, boxShadow: "0 5px 20px #173f3540", cursor: "pointer" }}>
        {promptEvent ? "نصب اپلیکیشن سارینا" : "راهنمای نصب سارینا"}
      </button>
    </div>
  );
}
