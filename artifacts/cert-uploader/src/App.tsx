import { useState, useRef, useEffect } from "react";
import "./app.css";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "errors"; blob: Blob; totalRows: number; errorRows: number }
  | { kind: "supabase-error"; blob: Blob; count: number; totalRows: number; supabaseError: string }
  | { kind: "success"; blob: Blob; count: number; totalRows: number; storageUrl: string | null };

type League = {
  name: string;
  shortName: string;
  threshold: number;
  color: string;
  bg: string;
  border: string;
  glow: string;
  gem: string;
  message: string;
  dancing: boolean;
};

const LEAGUES: League[] = [
  {
    name: "Изумрудная лига",
    shortName: "Изумрудной",
    threshold: 0,
    color: "#047857",
    bg: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
    border: "#6ee7b7",
    glow: "rgba(16,185,129,0.55)",
    gem: "🟢",
    message: "Старт качества есть. Сертификыч уже нашёл, где укрепить реестр.",
    dancing: false,
  },
  {
    name: "Сапфировая лига",
    shortName: "Сапфировой",
    threshold: 90,
    color: "#1d4ed8",
    bg: "linear-gradient(135deg, #eff6ff 0%, #f0f7ff 100%)",
    border: "#93c5fd",
    glow: "rgba(59,130,246,0.55)",
    gem: "🔵",
    message: "Хороший уровень. Большая часть записей прошла проверку.",
    dancing: false,
  },
  {
    name: "Рубиновая лига",
    shortName: "Рубиновой",
    threshold: 95,
    color: "#be123c",
    bg: "linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)",
    border: "#fda4af",
    glow: "rgba(244,63,94,0.55)",
    gem: "❤️",
    message: "Сильный результат. До идеального реестра осталось совсем немного.",
    dancing: false,
  },
  {
    name: "Алмазная лига",
    shortName: "Алмазной",
    threshold: 98,
    color: "#0369a1",
    bg: "linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%)",
    border: "#7dd3fc",
    glow: "rgba(56,189,248,0.65)",
    gem: "💎",
    message: "Почти безупречно. Реестр выглядит очень достойно.",
    dancing: false,
  },
  {
    name: "Бриллиантовая лига",
    shortName: "Бриллиантовой",
    threshold: 100,
    color: "#b45309",
    bg: "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
    border: "#fcd34d",
    glow: "rgba(245,158,11,0.7)",
    gem: "👑",
    message: "Идеальный реестр. Ни одной ошибки. Сертификыч танцует.",
    dancing: true,
  },
];

function getLeague(pct: number): League {
  if (pct >= 100) return LEAGUES[4];
  if (pct >= 98) return LEAGUES[3];
  if (pct >= 95) return LEAGUES[2];
  if (pct >= 90) return LEAGUES[1];
  return LEAGUES[0];
}

function pluralRecords(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "запись";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "записи";
  return "записей";
}

function nextLeagueHint(
  pct: number,
  total: number,
  errors: number,
): { name: string; toFix: number; gem: string; color: string; bg: string; border: string; glow: string } | null {
  const next = LEAGUES.find((l) => l.threshold > pct);
  if (!next || total === 0) return null;
  const maxErrorsAllowed = Math.floor(total * (1 - next.threshold / 100));
  const toFix = Math.max(1, errors - maxErrorsAllowed);
  return { name: next.shortName, toFix, gem: next.gem, color: next.color, bg: next.bg, border: next.border, glow: next.glow };
}

const LOADING_MSGS = [
  "⛏ Сертификыч исследует шахту...",
  "🔍 Проверяем номера документов...",
  "📅 Проверяем сроки действия сертификатов...",
  "💎 Ищем ценные сертификаты...",
  "📦 Сортируем найденные данные...",
  "⚙ Формируем итоговый файл...",
];

function HardHat({ size = 56 }: { size?: number }) {
  return (
    <div className="hardhat-hang" style={{ width: size, height: size }} title="Строительная каска" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="rgba(0,0,0,0.18)" />
        <path d="M8 46 C8 44 9.5 42.5 12 42.5 L52 42.5 C54.5 42.5 56 44 56 46 L56 48 C56 49.5 54.7 50.5 53 50.5 L11 50.5 C9.3 50.5 8 49.5 8 48 Z" fill="#d97316" />
        <path d="M16 44 C16 30 22 20 32 20 C42 20 48 30 48 44 Z" fill="#f97316" />
        <path d="M16 44 C16 30 22 20 32 20 C42 20 48 30 48 44 Z" fill="url(#hatShine)" fillOpacity="0.35" />
        <rect x="29.5" y="20.5" width="5" height="24" rx="2.5" fill="#ea580c" />
        <ellipse cx="27" cy="29" rx="4" ry="6" fill="#fb923c" fillOpacity="0.55" />
        <defs>
          <linearGradient id="hatShine" x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const WHEEL_COLORS = ["#10b981", "#3b82f6", "#f43f5e", "#38bdf8", "#f59e0b"];

function CyclingGems() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % LEAGUES.length), 650);
    return () => clearInterval(id);
  }, []);
  const l = LEAGUES[i];
  return (
    <span
      className="gem-glow"
      key={i}
      aria-hidden
      style={{ fontSize: "1.5rem", lineHeight: 1, flexShrink: 0, ["--gem-color" as string]: l.glow }}
      title={l.name}
    >
      {l.gem}
    </span>
  );
}

function FortuneWheel({
  phase,
  targetIndex,
  pct,
  size = 172,
}: {
  phase: "idle" | "spinning" | "landed";
  targetIndex: number | null;
  pct: number | null;
  size?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const rotRef = useRef(0);
  const seg = 360 / LEAGUES.length;

  useEffect(() => {
    if (phase === "landed" && targetIndex !== null) {
      const targetMod = 360 - (targetIndex * seg + seg / 2);
      const base = rotRef.current + 5 * 360;
      const baseMod = ((base % 360) + 360) % 360;
      const delta = (targetMod - baseMod + 360) % 360;
      const next = base + delta;
      rotRef.current = next;
      setRotation(next);
    } else if (phase === "idle") {
      rotRef.current = 0;
      setRotation(0);
    }
  }, [phase, targetIndex, seg]);

  const conic = `conic-gradient(${LEAGUES.map(
    (_, i) => `${WHEEL_COLORS[i]} ${i * seg}deg ${(i + 1) * seg}deg`,
  ).join(", ")})`;

  const r = size * 0.33;
  const center = size / 2;

  const hubLabel =
    phase === "landed" && pct !== null
      ? pct === 100
        ? "100%"
        : `${pct.toFixed(0)}%`
      : phase === "spinning"
        ? "⛏"
        : "🎯";

  return (
    <div className={`wheel-pendulum${phase === "idle" ? " wheel-swing" : ""}`} aria-hidden>
      <div style={{ width: 2, height: 22, margin: "0 auto", background: "linear-gradient(#cbd5e1,#94a3b8)" }} />
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#64748b", margin: "0 auto -6px", position: "relative", zIndex: 4 }} />
      <div style={{ position: "relative", width: size, height: size }}>
        <div
          style={{
            position: "absolute",
            top: -1,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "16px solid #0c2d6b",
            zIndex: 4,
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
          }}
        />
        <div
          className={phase === "spinning" ? "wheel-spin" : phase === "landed" ? "wheel-land" : ""}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: conic,
            border: "6px solid #fff",
            boxShadow: "0 10px 30px rgba(12,45,107,0.25), inset 0 0 0 2px rgba(255,255,255,0.5)",
            transform: phase === "landed" ? `rotate(${rotation}deg)` : undefined,
            position: "relative",
          }}
        >
          {LEAGUES.map((l, i) => {
            const a = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
            const x = center + r * Math.cos(a);
            const y = center + r * Math.sin(a);
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                  fontSize: size * 0.13,
                  lineHeight: 1,
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                }}
              >
                {l.gem}
              </span>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: phase === "landed" ? size * 0.115 : size * 0.15,
            color: "#0c2d6b",
            zIndex: 3,
          }}
        >
          {hubLabel}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [msgIndex, setMsgIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const isLoading = status.kind === "loading";

  useEffect(() => {
    if (!isLoading) return;
    setMsgIndex(0);
    const id = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, LOADING_MSGS.length - 1));
    }, 850);
    return () => clearInterval(id);
  }, [isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus({ kind: "loading" });

    const form = new FormData();
    form.append("password", password);
    form.append("file", file);

    try {
      const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
      const uploadStatus = res.headers.get("X-Upload-Status");
      const blob = await res.blob();

      if (!res.ok && !uploadStatus) {
        const text = await blob.text();
        let msg = "Ошибка сервера";
        try {
          msg = JSON.parse(text).error ?? msg;
        } catch {}
        setStatus({ kind: "idle" });
        alert(msg);
        return;
      }

      const totalRows = Number(res.headers.get("X-Total-Rows") ?? "0");

      if (uploadStatus === "errors") {
        const errorRows = Number(res.headers.get("X-Error-Rows") ?? "0");
        setStatus({ kind: "errors", blob, totalRows, errorRows });
        return;
      }

      const count = Number(res.headers.get("X-Record-Count") ?? "0");

      if (uploadStatus === "supabase-error") {
        const supabaseError = res.headers.get("X-Supabase-Error") ?? "Неизвестная ошибка Supabase";
        setStatus({ kind: "supabase-error", blob, count, totalRows, supabaseError });
        return;
      }

      const storageUrl = res.headers.get("X-Storage-Url");
      setStatus({ kind: "success", blob, count, totalRows, storageUrl });
    } catch {
      setStatus({ kind: "idle" });
      alert("Ошибка соединения с сервером");
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStatus({ kind: "idle" });
    setFile(null);
    setPassword("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const qualityPct = (() => {
    if (status.kind === "errors") {
      return status.totalRows > 0 ? ((status.totalRows - status.errorRows) / status.totalRows) * 100 : 0;
    }
    if (status.kind === "success" || status.kind === "supabase-error") return 100;
    return null;
  })();

  const league = qualityPct !== null ? getLeague(qualityPct) : null;
  const showResult = status.kind !== "idle" && status.kind !== "loading";

  const wheelPhase: "idle" | "spinning" | "landed" = isLoading
    ? "spinning"
    : showResult && league
      ? "landed"
      : "idle";
  const targetIndex = league ? LEAGUES.indexOf(league) : null;

  const totalRows =
    status.kind === "errors" || status.kind === "success" || status.kind === "supabase-error"
      ? status.totalRows
      : 0;
  const errorRows = status.kind === "errors" ? status.errorRows : 0;
  const correctRows = totalRows - errorRows;
  const todayStr = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  const hint = qualityPct !== null && league && !league.dancing ? nextLeagueHint(qualityPct, totalRows, errorRows) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 400px at 50% -120px, #dbeafe 0%, transparent 70%), linear-gradient(180deg, #f1f5fb 0%, #f8fafc 100%)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "2.5rem 1rem 3rem",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            marginBottom: "1.75rem",
            background: "linear-gradient(135deg, #0c2d6b 0%, #0c4b9d 100%)",
            borderRadius: 18,
            padding: "1.5rem 1.75rem",
            color: "#fff",
            boxShadow: "0 16px 40px rgba(12,45,107,0.28)",
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.01em" }}>
              Загрузчик реестров
            </h1>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#c7d8f5", lineHeight: 1.5 }}>
              Загрузите Excel-файл и узнай, на какую лигу претендует загрузка.
            </p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HardHat size={56} />
          </div>
        </div>

        {/* Hanging fortune wheel */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem", marginTop: "-0.25rem" }}>
          <FortuneWheel phase={wheelPhase} targetIndex={targetIndex} pct={qualityPct} />
        </div>

        {/* Upload card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(12,45,107,0.08)",
            padding: "1.75rem 2rem",
            marginBottom: "1.25rem",
            border: "1px solid #e0e7ff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#f1f5fb",
              border: "1px solid #e0e7ff",
              borderRadius: 12,
              padding: "0.75rem 1rem",
              marginBottom: "1.5rem",
            }}
          >
            <HardHat size={40} />
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0c2d6b", lineHeight: 1.4 }}>
              Привет, я Сертификатыч! Давай загрузим реестр 👋
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.125rem" }}>
              <label style={labelStyle}>🔑 Пароль администратора</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="Введите пароль"
                autoComplete="new-password"
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>📄 Excel-файл реестра</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  borderRadius: 16,
                  padding: "0.85rem 1rem",
                  background: "linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%)",
                  border: "1.5px dashed #93c5fd",
                  boxShadow: "0 0 0 4px rgba(147,197,253,0.15)",
                }}
              >
                <CyclingGems />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  style={{ ...inputStyle, padding: "0.45rem 0.6rem", cursor: "pointer", color: "#374151", borderRadius: 12, background: "#fff", flex: 1, minWidth: 0 }}
                />
              </div>
              <p style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "0.45rem", marginBottom: 0, lineHeight: 1.4 }}>
                Ожидаемые колонки: Номер документа · ФИО эксперта · Область производства судебной экспертизы · Срок
                действия сертификата
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.8rem",
                background: isLoading
                  ? "#93c5fd"
                  : "linear-gradient(135deg, #0c2d6b 0%, #0c4b9d 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: "0.9375rem",
                fontWeight: 700,
                cursor: isLoading ? "not-allowed" : "pointer",
                letterSpacing: "0.01em",
                boxShadow: isLoading ? "none" : "0 8px 20px rgba(12,45,107,0.25)",
                transition: "transform 0.1s, box-shadow 0.2s",
              }}
            >
              {isLoading ? "⛏ Идёт проверка..." : "💎 Проверить реестр"}
            </button>
          </form>
        </div>

        {/* Loading process */}
        {isLoading && (
          <div
            className="rise-in"
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 4px 24px rgba(12,45,107,0.07)",
              border: "1px solid #e0e7ff",
              padding: "1.75rem 2rem",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <HardHat size={56} />
            </div>
            <p key={msgIndex} className="fade-swap" style={{ margin: "1rem 0 1.25rem", fontWeight: 600, fontSize: "1rem", color: "#0c2d6b" }}>
              {LOADING_MSGS[msgIndex]}
            </p>
            <div className="mine-progress" />
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: "1rem" }}>
              {LOADING_MSGS.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: i <= msgIndex ? "#0c4b9d" : "#cbd5e1",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {showResult && league && qualityPct !== null && (
          <div className="rise-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Quality hero */}
            <div
              style={{
                background: league.bg,
                borderRadius: 18,
                border: `1px solid ${league.border}`,
                padding: "1.75rem",
                boxShadow: "0 10px 30px rgba(12,45,107,0.08)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: league.color, marginBottom: "0.75rem" }}>
                На какую лигу вы претендуете?
              </div>
              <div
                className="gem-glow"
                style={{ fontSize: "3rem", lineHeight: 1, ["--gem-color" as string]: league.glow }}
              >
                {league.gem}
              </div>
              <div style={{ fontSize: "2.75rem", fontWeight: 800, color: league.color, lineHeight: 1.1, marginTop: "0.5rem" }}>
                {qualityPct === 100 ? "100%" : `${qualityPct.toFixed(2)}%`}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: league.color, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                🏆 Качество реестра
              </div>
              <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: league.color, marginTop: "0.75rem" }}>
                {league.gem} {league.name}
              </div>
              <p style={{ margin: "0.5rem auto 0", fontSize: "0.875rem", color: league.color, opacity: 0.9, maxWidth: 440, lineHeight: 1.5 }}>
                {league.message}
              </p>

              {/* quality bar */}
              <div style={{ maxWidth: 440, margin: "1.25rem auto 0" }}>
                <div className="quality-bar">
                  <div
                    className="quality-bar-fill"
                    style={{ width: `${Math.max(2, qualityPct)}%`, background: league.color }}
                  />
                </div>
              </div>

              {/* progress to next league */}
              {hint && (
                <div
                  style={{
                    margin: "1.25rem auto 0",
                    maxWidth: 440,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    background: hint.bg,
                    border: `1px solid ${hint.border}`,
                    borderRadius: 12,
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                  }}
                >
                  <span
                    className="gem-glow"
                    style={{ fontSize: "2.25rem", lineHeight: 1, flexShrink: 0, ["--gem-color" as string]: hint.glow }}
                  >
                    {hint.gem}
                  </span>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: hint.color, opacity: 0.75 }}>
                      Следующая цель — {hint.name} лига
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: hint.color, marginTop: 2 }}>
                      Осталось исправить {hint.toFix} {pluralRecords(hint.toFix)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mining cards */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #bbf7d0",
                  padding: "1.25rem 1.5rem",
                  boxShadow: "0 4px 16px rgba(5,150,105,0.08)",
                }}
              >
                <div style={{ fontSize: "1.75rem", lineHeight: 1 }}>💎</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#047857", marginTop: "0.4rem" }}>{correctRows}</div>
                <div style={{ fontSize: "0.8125rem", color: "#15803d", fontWeight: 600 }}>Найдено драгоценных сертификатов</div>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${errorRows > 0 ? "#fecaca" : "#e5e7eb"}`,
                  padding: "1.25rem 1.5rem",
                  boxShadow: errorRows > 0 ? "0 4px 16px rgba(220,38,38,0.08)" : "0 4px 16px rgba(15,23,42,0.04)",
                }}
              >
                <div style={{ fontSize: "1.75rem", lineHeight: 1 }}>🪨</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: errorRows > 0 ? "#dc2626" : "#64748b", marginTop: "0.4rem" }}>{errorRows}</div>
                <div style={{ fontSize: "0.8125rem", color: errorRows > 0 ? "#b91c1c" : "#64748b", fontWeight: 600 }}>Требуют обработки</div>
              </div>
            </div>

            {/* Stats strip */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "1rem 1.25rem",
              }}
            >
              <MiniStat icon="📦" label="Всего записей" value={totalRows} color="#0c4b9d" />
              <MiniStat icon="✅" label="Корректных записей" value={correctRows} color="#047857" />
              <MiniStat icon="🪨" label="Записей с ошибками" value={errorRows} color={errorRows > 0 ? "#dc2626" : "#64748b"} />
            </div>

            {/* Action card */}
            {status.kind === "errors" && (
              <div
                style={{
                  background: "#fff7f7",
                  border: "1px solid #fca5a5",
                  borderRadius: 14,
                  padding: "1.25rem 1.5rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#991b1b", fontSize: "0.9375rem" }}>
                  🐜 Сертификыч нашёл записи, которые лучше исправить до публикации.
                </p>
                <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#7f1d1d" }}>
                  Строк с ошибками: <strong>{status.errorRows}</strong> ({((status.errorRows / status.totalRows) * 100).toFixed(1)}%)
                </p>
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 9,
                    padding: "0.625rem 0.875rem",
                    fontSize: "0.8125rem",
                    color: "#7f1d1d",
                    marginBottom: "1rem",
                    lineHeight: 1.5,
                  }}
                >
                  ✋ Рабочий реестр не изменён. Данные на сайте остались прежними.
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => downloadBlob(status.blob, "errors.xlsx")} style={actionBtn("#dc2626")}>
                    ⬇ Скачать Excel с ошибками
                  </button>
                  <button onClick={reset} style={ghostBtn}>
                    Загрузить другой файл
                  </button>
                </div>
              </div>
            )}

            {(status.kind === "success" || status.kind === "supabase-error") && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 14,
                  padding: "1.25rem 1.5rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#14532d", fontSize: "0.9375rem" }}>
                  🎉 Реестр успешно обновлён
                </p>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", color: "#166534" }}>
                  Загружено записей: <strong>{status.count}</strong>
                </p>
                <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#166534" }}>
                  Дата загрузки: <strong>{todayStr}</strong>
                </p>
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #bbf7d0",
                    borderRadius: 9,
                    padding: "0.625rem 0.875rem",
                    fontSize: "0.8125rem",
                    color: "#166534",
                    marginBottom: "1rem",
                    lineHeight: 1.5,
                  }}
                >
                  💾 Резервный JS-файл сохраните на случай ручного восстановления.
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: status.kind === "supabase-error" ? "1rem" : 0 }}>
                  <button onClick={() => downloadBlob(status.blob, "table_sert_centr_sud_expert.js")} style={actionBtn("#0c4b9d")}>
                    ⬇ Скачать готовый JS-файл
                  </button>
                  {status.kind === "success" && status.storageUrl && (
                    <a href={status.storageUrl} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>
                      🔗 Открыть файл в Storage
                    </a>
                  )}
                  <button onClick={reset} style={ghostBtn}>
                    Загрузить другой файл
                  </button>
                </div>

                {status.kind === "supabase-error" && (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fcd34d",
                      borderRadius: 9,
                      padding: "0.75rem 0.875rem",
                      fontSize: "0.8125rem",
                      color: "#78350f",
                      lineHeight: 1.5,
                    }}
                  >
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>⚠️ Файл в Storage не обновился.</p>
                    <p style={{ margin: 0 }}>
                      Но готовый JS-файл сформирован и доступен для скачивания.
                    </p>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", opacity: 0.75 }}>{status.supabaseError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "0.72rem", color: "#94a3b8", marginTop: "2rem" }}>
          🐜 Палата судебных экспертов · Реестр сертификатов
        </p>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, textAlign: "center" }}>
      <div style={{ fontSize: "1rem", lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: "1.375rem", fontWeight: 800, color, marginTop: "0.3rem", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "0.4rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.85rem",
  border: "1px solid #d1d5db",
  borderRadius: 9,
  fontSize: "0.875rem",
  boxSizing: "border-box",
  outline: "none",
  background: "#fafafa",
};

function actionBtn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "0.6rem 1.1rem",
    fontSize: "0.8125rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const ghostBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "0.6rem 1.1rem",
  fontSize: "0.8125rem",
  color: "#475569",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
