import { useState, useRef } from "react";
import "./app.css";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "errors"; blob: Blob; totalRows: number; errorRows: number }
  | { kind: "supabase-error"; blob: Blob; count: number; totalRows: number; supabaseError: string }
  | { kind: "success"; blob: Blob; count: number; totalRows: number };

type League = {
  name: string;
  color: string;
  bg: string;
  border: string;
  gem: string;
  message: string;
  dancing: boolean;
};

function getLeague(pct: number): League {
  if (pct === 100) return {
    name: "Бриллиантовая лига",
    color: "#92400e",
    bg: "#fffbeb",
    border: "#f59e0b",
    gem: "💎",
    message: "Идеальный реестр. Ни одной ошибки. Сертификыч танцует.",
    dancing: true,
  };
  if (pct >= 98) return {
    name: "Алмазная лига",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#7dd3fc",
    gem: "🔷",
    message: "Почти безупречно. Реестр выглядит очень достойно.",
    dancing: false,
  };
  if (pct >= 95) return {
    name: "Рубиновая лига",
    color: "#991b1b",
    bg: "#fff1f2",
    border: "#fda4af",
    gem: "♦️",
    message: "Сильный результат. До идеального реестра осталось немного.",
    dancing: false,
  };
  if (pct >= 90) return {
    name: "Сапфировая лига",
    color: "#1e40af",
    bg: "#eff6ff",
    border: "#93c5fd",
    gem: "🔹",
    message: "Хороший уровень. Большая часть записей прошла проверку.",
    dancing: false,
  };
  return {
    name: "Изумрудная лига",
    color: "#065f46",
    bg: "#f0fdf4",
    border: "#6ee7b7",
    gem: "🟢",
    message: "Старт качества есть. Сертификыч уже нашёл, где укрепить реестр.",
    dancing: false,
  };
}

function Sertifikych({ state }: { state: "idle" | "error" | "dance" }) {
  return (
    <div className={`sertifikych ${state === "dance" ? "sertifikych-dance" : ""}`} title="Муравей Сертификыч">
      <span className="sertifikych-body">🐜</span>
      <span className="sertifikych-hat">{state === "error" ? "🔍" : "⛑️"}</span>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "0.875rem 1rem",
      flex: 1,
      minWidth: 100,
      textAlign: "center" as const,
    }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent ?? "#1e3a8a", lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

export default function App() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

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
        try { msg = JSON.parse(text).error ?? msg; } catch {}
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

      setStatus({ kind: "success", blob, count, totalRows });
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

  const isLoading = status.kind === "loading";

  const qualityPct = (() => {
    if (status.kind === "errors") {
      return status.totalRows > 0
        ? ((status.totalRows - status.errorRows) / status.totalRows) * 100
        : 0;
    }
    if (status.kind === "success" || status.kind === "supabase-error") return 100;
    return null;
  })();

  const league = qualityPct !== null ? getLeague(qualityPct) : null;

  const showResult = status.kind !== "idle" && status.kind !== "loading";
  const antState = status.kind === "errors" ? "error" : (league?.dancing ? "dance" : "idle");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "2rem 1rem",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ width: 36, height: 36, background: "#1e3a8a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>📋</div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#1e3a8a", margin: 0 }}>
              Загрузчик реестра сертификатов
            </h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
            Проверьте Excel-файл, обновите реестр и получите готовый JS-файл для резервной загрузки.
          </p>
        </div>

        {/* Upload card */}
        <div style={{
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 4px 24px rgba(30,58,138,0.08)",
          padding: "1.75rem 2rem",
          marginBottom: "1.25rem",
          border: "1px solid #e0e7ff",
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.125rem" }}>
              <label style={labelStyle}>Пароль администратора</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="Введите пароль"
                autoComplete="new-password"
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Excel-файл</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                required
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: "0.4rem 0.6rem", cursor: "pointer", color: "#374151" }}
              />
              <p style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "0.375rem", marginBottom: 0 }}>
                Ожидаемые колонки: Номер документа · ФИО эксперта · Область производства судебной экспертизы · Срок действия сертификата
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.7rem",
                background: isLoading ? "#93c5fd" : "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                letterSpacing: "0.01em",
                transition: "background 0.2s",
              }}
            >
              {isLoading ? "⏳ Проверяю файл..." : "✅ Проверить и загрузить"}
            </button>
          </form>
        </div>

        {/* Result block */}
        {showResult && league && (
          <div style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 4px 24px rgba(30,58,138,0.07)",
            border: `1px solid ${league.border}`,
            overflow: "hidden",
          }}>
            {/* League banner */}
            <div style={{
              background: league.bg,
              borderBottom: `1px solid ${league.border}`,
              padding: "1.125rem 1.75rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}>
              <Sertifikych state={antState} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "1.125rem" }}>{league.gem}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: league.color }}>{league.name}</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: league.color, opacity: 0.85 }}>{league.message}</p>
              </div>
            </div>

            {/* Stats row */}
            {(() => {
              const totalRows = status.kind === "errors" ? status.totalRows
                : status.kind === "success" ? status.totalRows
                : status.kind === "supabase-error" ? status.totalRows : 0;
              const errorRows = status.kind === "errors" ? status.errorRows : 0;
              const correctRows = totalRows - errorRows;
              const pctDisplay = qualityPct !== null
                ? (qualityPct === 100 ? "100%" : `${qualityPct.toFixed(2)}%`)
                : "—";

              return (
                <div style={{ padding: "1.25rem 1.5rem", display: "flex", gap: "0.625rem", flexWrap: "wrap" as const }}>
                  <StatCard label="Всего записей" value={totalRows} />
                  <StatCard label="Корректных" value={correctRows} accent="#059669" />
                  <StatCard label="С ошибками" value={errorRows} accent={errorRows > 0 ? "#dc2626" : "#059669"} />
                  <StatCard label="Качество" value={pctDisplay} accent={league.color} />
                </div>
              );
            })()}

            {/* Status-specific content */}
            <div style={{ padding: "0 1.5rem 1.5rem" }}>

              {status.kind === "errors" && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: 10,
                  padding: "1rem 1.25rem",
                }}>
                  <p style={{ margin: "0 0 0.5rem", fontWeight: 600, color: "#991b1b", fontSize: "0.9rem" }}>
                    🔎 Сертификыч нашёл записи, которые лучше поправить перед публикацией.
                  </p>
                  <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#7f1d1d" }}>
                    Строк с ошибками: <strong>{status.errorRows}</strong> ({((status.errorRows / status.totalRows) * 100).toFixed(1)}%)
                  </p>
                  <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#6b7280" }}>
                    Рабочий файл не обновлён. Данные на сайте остались прежними.
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const, alignItems: "center" }}>
                    <button
                      onClick={() => downloadBlob(status.blob, "errors.xlsx")}
                      style={actionBtn("#dc2626")}
                    >
                      ⬇ Скачать Excel с ошибками
                    </button>
                    <button onClick={reset} style={ghostBtn}>Загрузить другой файл</button>
                  </div>
                </div>
              )}

              {(status.kind === "success" || status.kind === "supabase-error") && (
                <div>
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: 10,
                    padding: "1rem 1.25rem",
                    marginBottom: "0.75rem",
                  }}>
                    <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "#14532d", fontSize: "0.9rem" }}>
                      ✅ Реестр успешно обновлён.
                    </p>
                    <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#166534" }}>
                      Загружено записей: <strong>{status.count}</strong>
                    </p>
                    <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "#6b7280" }}>
                      Резервный JS-файл сохраните на случай ручного восстановления старой схемы.
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const, alignItems: "center" }}>
                      <button
                        onClick={() => downloadBlob(status.blob, "table_sert_centr_sud_expert.js")}
                        style={actionBtn("#1e3a8a")}
                      >
                        ⬇ Скачать готовый JS-файл
                      </button>
                      <button onClick={reset} style={ghostBtn}>Загрузить другой файл</button>
                    </div>
                  </div>

                  {status.kind === "success" && (
                    <div style={{
                      background: "#f0f9ff",
                      border: "1px solid #7dd3fc",
                      borderRadius: 10,
                      padding: "0.75rem 1.25rem",
                      fontSize: "0.8125rem",
                      color: "#0c4a6e",
                    }}>
                      ☁️ Файл в Storage обновлён. Тильда сможет забрать актуальные данные по новой ссылке.
                    </div>
                  )}

                  {status.kind === "supabase-error" && (
                    <div style={{
                      background: "#fffbeb",
                      border: "1px solid #fcd34d",
                      borderRadius: 10,
                      padding: "0.75rem 1.25rem",
                      fontSize: "0.8125rem",
                      color: "#78350f",
                    }}>
                      <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>⚠️ Файл в Storage не обновился.</p>
                      <p style={{ margin: "0 0 0.25rem" }}>Но готовый JS-файл сформирован. Его можно скачать и загрузить вручную старым способом.</p>
                      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.8 }}>{status.supabaseError}</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#9ca3af", marginTop: "1.5rem" }}>
          Палата судебных экспертов · Реестр сертификатов
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "#374151",
  marginBottom: "0.375rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 7,
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
    borderRadius: 7,
    padding: "0.5rem 1rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };
}

const ghostBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  padding: "0.5rem 1rem",
  fontSize: "0.8125rem",
  color: "#6b7280",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
