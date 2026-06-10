import { useState, useRef } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "errors"; blob: Blob }
  | { kind: "supabase-error"; blob: Blob; count: number; supabaseError: string }
  | { kind: "success"; blob: Blob; count: number };

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

      if (uploadStatus === "errors") {
        setStatus({ kind: "errors", blob });
        return;
      }

      const count = Number(res.headers.get("X-Record-Count") ?? "0");

      if (uploadStatus === "supabase-error") {
        const supabaseError = res.headers.get("X-Supabase-Error") ?? "Неизвестная ошибка Supabase";
        setStatus({ kind: "supabase-error", blob, count, supabaseError });
        return;
      }

      setStatus({ kind: "success", blob, count });
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

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", padding: "2rem 2.5rem", width: "100%", maxWidth: 480 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111827" }}>
          Загрузка реестра сертификатов
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Пароль администратора</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="Введите пароль"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Excel-файл</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              required
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ ...inputStyle, padding: "0.375rem 0.5rem", cursor: "pointer" }}
            />
          </div>

          <button
            type="submit"
            disabled={status.kind === "loading"}
            style={btnStyle(status.kind === "loading")}
          >
            {status.kind === "loading" ? "Загрузка..." : "Загрузить"}
          </button>
        </form>

        {status.kind === "errors" && (
          <div style={resultBox("#fef2f2", "#dc2626")}>
            <p style={{ margin: "0 0 0.75rem" }}>
              <strong>Найдены ошибки.</strong> Исправьте файл и загрузите повторно.
            </p>
            <button
              onClick={() => downloadBlob(status.blob, "errors.xlsx")}
              style={linkBtn("#dc2626")}
            >
              Скачать файл с ошибками
            </button>
            <button onClick={reset} style={{ ...linkBtn("#6b7280"), marginLeft: "1rem" }}>Сбросить</button>
          </div>
        )}

        {status.kind === "success" && (
          <div style={resultBox("#f0fdf4", "#16a34a")}>
            <p style={{ margin: "0 0 0.75rem" }}>
              <strong>Файл успешно загружен.</strong> Загружено записей: {status.count}
            </p>
            <button
              onClick={() => downloadBlob(status.blob, "table_sert_centr_sud_expert.js")}
              style={linkBtn("#16a34a")}
            >
              Скачать JS-файл
            </button>
            <button onClick={reset} style={{ ...linkBtn("#6b7280"), marginLeft: "1rem" }}>Загрузить ещё</button>
          </div>
        )}

        {status.kind === "supabase-error" && (
          <div style={resultBox("#fffbeb", "#d97706")}>
            <p style={{ margin: "0 0 0.25rem" }}>
              <strong>Данные обработаны ({status.count} записей), но загрузка в Supabase не удалась.</strong>
            </p>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#92400e" }}>{status.supabaseError}</p>
            <button
              onClick={() => downloadBlob(status.blob, "table_sert_centr_sud_expert.js")}
              style={linkBtn("#d97706")}
            >
              Скачать JS-файл вручную
            </button>
            <button onClick={reset} style={{ ...linkBtn("#6b7280"), marginLeft: "1rem" }}>Сбросить</button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
  marginBottom: "0.375rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.9rem",
  boxSizing: "border-box",
  outline: "none",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.625rem",
    background: disabled ? "#9ca3af" : "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "1rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function resultBox(bg: string, border: string): React.CSSProperties {
  return {
    marginTop: "1.25rem",
    padding: "1rem",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 6,
    color: "#111827",
    fontSize: "0.9rem",
  };
}

function linkBtn(color: string): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    color,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontSize: "0.875rem",
    textDecoration: "underline",
  };
}
