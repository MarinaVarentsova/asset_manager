import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const COL_DOC = "Номер документа";
const COL_EXPERT = "ФИО эксперта";
const COL_AREA = "Область производства судебной экспертизы";
const COL_VALIDITY = "Срок действия сертификата";
const COL_ROW = "№ строки";
const COL_ERRORS = "Ошибки";

const DATE_RANGE_RE = /^(\d{2}\.\d{2}\.\d{4})-(\d{2}\.\d{2}\.\d{4})$/;

// Escape every non-ASCII character (e.g. Cyrillic) as a \uXXXX unicode escape so
// the generated JS file is pure ASCII. This makes it render correctly in the
// browser and on Tilda regardless of how Supabase Storage serves the file's
// charset, while still executing as normal Cyrillic at runtime.
function escapeNonAscii(str: string): string {
  return str.replace(/[\u0080-\uFFFF]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

const JS_CONTENT_TYPE = "application/javascript; charset=utf-8";

function parseDate(s: string): Date | null {
  const parts = s.split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function normalizeDocNum(raw: string): string {
  return raw
    .replace(/А/g, "A")
    .replace(/Р/g, "P")
    .replace(/С/g, "C")
    .replace(/Е/g, "E")
    .replace(/О/g, "O")
    .replace(/Х/g, "X")
    .replace(/\s+/g, " ")
    .trim();
}

const DOC_NUM_RE = /^(№\s*)?(PS|AS|CS|CP)\s*(\d{4,6})$/;

function canonicalDocNum(normalized: string): string | null {
  const m = DOC_NUM_RE.exec(normalized);
  if (!m) return null;
  return `№ ${m[2]} ${m[3]}`;
}

type CleanRow = {
  [COL_DOC]: string;
  [COL_EXPERT]: string;
  [COL_AREA]: string;
  [COL_VALIDITY]: string;
};

function extractRow(row: Record<string, unknown>): CleanRow {
  return {
    [COL_DOC]: String(row[COL_DOC] ?? "").trim(),
    [COL_EXPERT]: String(row[COL_EXPERT] ?? "").trim(),
    [COL_AREA]: String(row[COL_AREA] ?? "").trim(),
    [COL_VALIDITY]: String(row[COL_VALIDITY] ?? "").trim(),
  };
}

function validateRow(clean: CleanRow): string[] {
  const { [COL_DOC]: docNum, [COL_EXPERT]: expert, [COL_AREA]: area, [COL_VALIDITY]: validity } = clean;
  const anyFilled = docNum || expert || area || validity;
  if (!anyFilled) return [];

  const errors: string[] = [];

  if (!docNum) {
    errors.push("Номер документа обязателен");
  } else {
    const norm = normalizeDocNum(docNum);
    if (!canonicalDocNum(norm)) {
      errors.push("Номер документа должен быть в формате PS/AS/CS/CP + 4–6 цифр");
    }
  }

  if (!expert) {
    errors.push("ФИО эксперта обязательно");
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

  return errors;
}

function endDateFromValidity(validity: string): Date {
  const match = DATE_RANGE_RE.exec(validity);
  if (!match) return new Date(0);
  return parseDate(match[2]) ?? new Date(0);
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
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const cleanRows = rawRows.map(extractRow);
    const validationResults = cleanRows.map(validateRow);

    const nonEmptyIndices = cleanRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row[COL_DOC] || row[COL_EXPERT] || row[COL_AREA] || row[COL_VALIDITY])
      .map(({ i }) => i);

    const totalRows = nonEmptyIndices.length;
    const errorIndices = nonEmptyIndices.filter((i) => validationResults[i].length > 0);
    const errorRows = errorIndices.length;
    const hasErrors = errorRows > 0;

    if (hasErrors) {
      const errorWorkbook = XLSX.utils.book_new();
      const errorRowsData = errorIndices.map((i) => ({
        [COL_ROW]: i + 2,
        [COL_DOC]: cleanRows[i][COL_DOC],
        [COL_EXPERT]: cleanRows[i][COL_EXPERT],
        [COL_AREA]: cleanRows[i][COL_AREA],
        [COL_VALIDITY]: cleanRows[i][COL_VALIDITY],
        [COL_ERRORS]: validationResults[i].join("; "),
      }));
      const errorSheet = XLSX.utils.json_to_sheet(errorRowsData, {
        header: [COL_ROW, COL_DOC, COL_EXPERT, COL_AREA, COL_VALIDITY, COL_ERRORS],
      });
      XLSX.utils.book_append_sheet(errorWorkbook, errorSheet, "Ошибки");
      const errorBuffer = XLSX.write(errorWorkbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="errors.xlsx"');
      res.setHeader("X-Upload-Status", "errors");
      res.setHeader("X-Total-Rows", String(totalRows));
      res.setHeader("X-Error-Rows", String(errorRows));
      res.send(errorBuffer);
      return;
    }

    const validNonEmptyRows = nonEmptyIndices.map((i) => cleanRows[i]);

    const sortedRows = [...validNonEmptyRows].sort((a, b) => {
      const da = endDateFromValidity(a[COL_VALIDITY]);
      const db = endDateFromValidity(b[COL_VALIDITY]);
      return db.getTime() - da.getTime();
    });

    const outputRows = sortedRows.map((row) => ({
      [COL_DOC]: canonicalDocNum(normalizeDocNum(row[COL_DOC])) ?? row[COL_DOC],
      [COL_EXPERT]: row[COL_EXPERT],
      [COL_AREA]: row[COL_AREA],
      [COL_VALIDITY]: row[COL_VALIDITY],
    }));

    const dataLiteral = escapeNonAscii(JSON.stringify(outputRows, null, 2));
    const jsContent =
      `(function waitForGetData(){\n` +
      `  var data = ${dataLiteral};\n` +
      `  if (typeof window !== "undefined" && typeof window.getData === "function") {\n` +
      `    window.getData(data);\n` +
      `  } else if (typeof getData === "function") {\n` +
      `    getData(data);\n` +
      `  } else {\n` +
      `    setTimeout(waitForGetData, 50);\n` +
      `  }\n` +
      `})();\n`;

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
        .upload(backupPath, backupBuffer, { contentType: JS_CONTENT_TYPE, upsert: false });
      if (backupErr) {
        supabaseError = `Не удалось создать резервную копию: ${backupErr.message}`;
      }
    }

    if (!supabaseError) {
      const jsBuffer = Buffer.from(jsContent, "utf-8");
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(currentPath, jsBuffer, { contentType: JS_CONTENT_TYPE, upsert: true });
      if (uploadErr) {
        supabaseError = `Не удалось загрузить файл в Supabase: ${uploadErr.message}`;
      }
    }

    const jsFileBuffer = Buffer.from(jsContent, "utf-8");
    res.setHeader("X-Upload-Status", supabaseError ? "supabase-error" : "success");
    res.setHeader("X-Record-Count", String(outputRows.length));
    res.setHeader("X-Total-Rows", String(totalRows));
    if (!supabaseError) {
      const publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${currentPath}`;
      res.setHeader("X-Storage-Url", publicUrl);
    }
    if (supabaseError) {
      res.setHeader("X-Supabase-Error", supabaseError);
    }
    res.setHeader("Content-Type", JS_CONTENT_TYPE);
    res.setHeader("Content-Disposition", 'attachment; filename="table_sert_centr_sud_expert.js"');
    res.send(jsFileBuffer);
  } catch (err) {
    req.log.error({ err }, "Upload error");
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

export default router;
