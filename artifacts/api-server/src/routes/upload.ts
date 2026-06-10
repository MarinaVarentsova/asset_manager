import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const COLUMNS = {
  docNum: "Номер документа",
  expert: "ФИО эксперта",
  area: "Область производства судебной экспертизы",
  validity: "Срок действия сертификата",
};

const DOC_NUM_RE = /^(№\s*)?(PS|AS)\s*\d{6}$/;
const DATE_RANGE_RE = /^(\d{2}\.\d{2}\.\d{4})-(\d{2}\.\d{2}\.\d{4})$/;

function parseDate(s: string): Date | null {
  const parts = s.split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function validateRows(rows: Record<string, unknown>[]): { valid: boolean; errors: string[] }[] {
  return rows.map((row) => {
    const docNum = String(row[COLUMNS.docNum] ?? "").trim();
    const expert = String(row[COLUMNS.expert] ?? "").trim();
    const area = String(row[COLUMNS.area] ?? "").trim();
    const validity = String(row[COLUMNS.validity] ?? "").trim();

    const anyFilled = docNum || expert || area || validity;
    if (!anyFilled) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];

    if (!docNum) {
      errors.push("Номер документа обязателен");
    } else if (!DOC_NUM_RE.test(docNum)) {
      errors.push("Номер документа должен быть в формате PS 000000, AS 000000, № PS 000000 или № AS 000000");
    }

    if (!expert) {
      errors.push("ФИО эксперта обязательно");
    } else {
      const words = expert.split(/\s+/).filter(Boolean);
      if (words.length !== 3) {
        errors.push("ФИО эксперта должно состоять из 3 слов");
      }
    }

    if (!area) {
      errors.push("Область производства судебной экспертизы обязательна");
    }

    if (!validity) {
      errors.push("Срок действия сертификата обязателен");
    } else {
      const match = DATE_RANGE_RE.exec(validity);
      if (!match) {
        errors.push("Срок действия должен быть в формате ДД.ММ.ГГГГ-ДД.ММ.ГГГГ");
      } else {
        const start = parseDate(match[1]);
        const end = parseDate(match[2]);
        if (!start) errors.push("Дата начала недействительна");
        if (!end) errors.push("Дата окончания недействительна");
        if (start && end && start > end) {
          errors.push("Дата начала не может быть позже даты окончания");
        }
      }
    }

    return { valid: errors.length === 0, errors };
  });
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const password = req.body?.password as string | undefined;
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Неверный пароль администратора" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Файл не выбран" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const validations = validateRows(rows);
    const hasErrors = validations.some((v) => v.errors.length > 0);

    if (hasErrors) {
      const errorWorkbook = XLSX.utils.book_new();
      const errorRows = rows.map((row, i) => ({
        ...row,
        Ошибки: validations[i].errors.join("; "),
      }));
      const errorSheet = XLSX.utils.json_to_sheet(errorRows);
      XLSX.utils.book_append_sheet(errorWorkbook, errorSheet, "Ошибки");
      const errorBuffer = XLSX.write(errorWorkbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="errors.xlsx"');
      res.setHeader("X-Upload-Status", "errors");
      res.send(errorBuffer);
      return;
    }

    const dataRows = rows.filter((_, i) => validations[i].valid && (
      String(rows[i][COLUMNS.docNum] ?? "").trim() ||
      String(rows[i][COLUMNS.expert] ?? "").trim() ||
      String(rows[i][COLUMNS.area] ?? "").trim() ||
      String(rows[i][COLUMNS.validity] ?? "").trim()
    ));

    const jsContent = `getData(${JSON.stringify(
      dataRows.map((row) => ({
        [COLUMNS.docNum]: String(row[COLUMNS.docNum] ?? "").trim(),
        [COLUMNS.expert]: String(row[COLUMNS.expert] ?? "").trim(),
        [COLUMNS.area]: String(row[COLUMNS.area] ?? "").trim(),
        [COLUMNS.validity]: String(row[COLUMNS.validity] ?? "").trim(),
      })),
      null,
      2
    )});\n`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET;

    if (!supabaseUrl || !supabaseKey || !bucket) {
      res.status(500).json({ error: "Supabase не настроен" });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const currentPath = "current/table_sert_centr_sud_expert.js";
    const backupPath = `backups/table_sert_centr_sud_expert_${ts}.js`;

    let supabaseError: string | null = null;

    const { data: existing } = await supabase.storage.from(bucket).download(currentPath);
    if (existing) {
      const backupBuffer = Buffer.from(await existing.arrayBuffer());
      const { error: backupErr } = await supabase.storage
        .from(bucket)
        .upload(backupPath, backupBuffer, { contentType: "application/javascript", upsert: false });
      if (backupErr) {
        supabaseError = `Не удалось создать резервную копию: ${backupErr.message}`;
      }
    }

    if (!supabaseError) {
      const jsBuffer = Buffer.from(jsContent, "utf-8");
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(currentPath, jsBuffer, { contentType: "application/javascript", upsert: true });
      if (uploadErr) {
        supabaseError = `Не удалось загрузить файл в Supabase: ${uploadErr.message}`;
      }
    }

    const jsFileBuffer = Buffer.from(jsContent, "utf-8");
    res.setHeader("X-Upload-Status", supabaseError ? "supabase-error" : "success");
    res.setHeader("X-Record-Count", String(dataRows.length));
    if (supabaseError) {
      res.setHeader("X-Supabase-Error", supabaseError);
    }
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Content-Disposition", 'attachment; filename="table_sert_centr_sud_expert.js"');
    res.send(jsFileBuffer);
  } catch (err) {
    req.log.error({ err }, "Upload error");
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
