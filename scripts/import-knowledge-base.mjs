import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { pipeline, env } from "@huggingface/transformers";
import { PDFParse } from "pdf-parse";

/* =========================================================
 * 1. 載入環境變數
 * ======================================================= */

dotenv.config({
  path: path.resolve(process.cwd(), ".env.rag"),
});

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,

  KNOWLEDGE_BASE_PATH = "./knowledge_base",

  HUGGINGFACE_EMBEDDING_MODEL = "Xenova/multilingual-e5-small",
  HUGGINGFACE_CACHE_PATH = "./.cache/huggingface",

  /*
   * one_per_category：
   * 每次從 00～07 各找一篇尚未匯入的 PDF。
   *
   * all：
   * 處理全部尚未匯入的 PDF。
   */
  IMPORT_MODE = "all",

  /*
   * one_per_category 模式下：
   * 最多處理幾個分類。
   *
   * 00～07 共 8 個核心分類，所以預設為 8。
   *
   * all 模式下：
   * 0 代表不限數量。
   */
  IMPORT_LIMIT = "239",
} = process.env;

/* =========================================================
 * 2. 驗證環境變數
 * ======================================================= */

function validateEnvironmentVariables() {
  const requiredVariables = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      [
        `缺少環境變數：${missingVariables.join(", ")}`,
        "請確認專案根目錄中的 .env.rag。",
      ].join("\n")
    );
  }
}

validateEnvironmentVariables();

/* =========================================================
 * 3. Supabase Client
 * ======================================================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/* =========================================================
 * 4. Hugging Face 設定
 * ======================================================= */

env.cacheDir = path.resolve(
  process.cwd(),
  HUGGINGFACE_CACHE_PATH
);

env.allowRemoteModels = true;

let embeddingPipeline = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log(
      `載入 Hugging Face 模型：${HUGGINGFACE_EMBEDDING_MODEL}`
    );

    embeddingPipeline = await pipeline(
      "feature-extraction",
      HUGGINGFACE_EMBEDDING_MODEL
    );

    console.log("Hugging Face 模型載入完成。");
  }

  return embeddingPipeline;
}

/* =========================================================
 * 5. 基本設定
 * ======================================================= */

const KNOWLEDGE_DIRECTORY = path.resolve(
  process.cwd(),
  KNOWLEDGE_BASE_PATH
);

const EXPECTED_EMBEDDING_DIMENSION = 384;

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;

const MINIMUM_DOCUMENT_TEXT_LENGTH = 500;
const MINIMUM_CHUNK_LENGTH = 200;

const CORE_CATEGORY_PREFIXES = [
  "00_",
  "01_",
  "02_",
  "03_",
  "04_",
  "05_",
  "06_",
  "07_",
];

const EXCLUDED_FOLDER_PREFIXES = [
  "98_",
  "99_",
];

const CATEGORY_MAP = [
  {
    prefix: "00_",
    gameKey: "COMMON",
    ability: "executive_function_child_development",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "01_",
    gameKey: "SRT",
    ability: "reaction_time_processing_speed",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "02_",
    gameKey: "PM",
    ability: "visual_working_memory",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "03_",
    gameKey: "CBT",
    ability: "sequence_spatial_working_memory",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "04_",
    gameKey: "DPT",
    ability: "selective_attention_response_inhibition",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "05_",
    gameKey: "DCCS",
    ability: "cognitive_flexibility_task_switching",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "06_",
    gameKey: "LB",
    ability: "rule_sequence_planning",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "07_",
    gameKey: "COMMON",
    ability:
      "reliability_validity_practice_effects_limitations",
    population: "GENERAL",
    isCore: true,
  },
  {
    prefix: "08_",
    gameKey: "COMMON",
    ability: "special_population_intervention",
    population: "SPECIAL",
    isCore: false,
  },
  {
    prefix: "09_",
    gameKey: "COMMON",
    ability: "neural_mechanism_extended_topic",
    population: "GENERAL",
    isCore: false,
  },
];

/* =========================================================
 * 6. 基本工具
 * ======================================================= */

function normalizeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    // 合併英文斷字。
    .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")

    // 保留空白段落，一般換行改為空格。
    .replace(/(?<!\n)\n(?!\n)/g, " ")

    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createFileHash(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function createDocumentTitle(fileName) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRelativePath(filePath) {
  return path
    .relative(KNOWLEDGE_DIRECTORY, filePath)
    .split(path.sep)
    .join("/");
}

function getCategoryFolder(filePath) {
  const relativePath = path.relative(
    KNOWLEDGE_DIRECTORY,
    filePath
  );

  return relativePath.split(path.sep)[0];
}

function inferMetadata(filePath) {
  const categoryFolder =
    getCategoryFolder(filePath);

  const matchedCategory = CATEGORY_MAP.find(
    (category) =>
      categoryFolder.startsWith(category.prefix)
  );

  return {
    category: categoryFolder,
    gameKey: matchedCategory?.gameKey || "COMMON",
    ability: matchedCategory?.ability || "unknown",
    population:
      matchedCategory?.population || "GENERAL",
    isCore: matchedCategory?.isCore ?? false,
  };
}

function parseImportLimit() {
  const parsedValue = Number.parseInt(
    String(IMPORT_LIMIT),
    10
  );

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return 8;
  }

  return parsedValue;
}

/* =========================================================
 * 7. PDF 切段
 * ======================================================= */

function splitLongParagraph(paragraph) {
  const chunks = [];

  const step = Math.max(
    1,
    CHUNK_SIZE - CHUNK_OVERLAP
  );

  for (
    let index = 0;
    index < paragraph.length;
    index += step
  ) {
    const chunk = paragraph
      .slice(index, index + CHUNK_SIZE)
      .trim();

    if (
      chunk.length >= MINIMUM_CHUNK_LENGTH
    ) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function splitTextIntoChunks(text) {
  const cleanText = normalizeText(text);

  if (!cleanText) {
    return [];
  }

  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_SIZE) {
      if (
        currentChunk.length >=
        MINIMUM_CHUNK_LENGTH
      ) {
        chunks.push(currentChunk.trim());
      }

      currentChunk = "";

      chunks.push(
        ...splitLongParagraph(paragraph)
      );

      continue;
    }

    const candidate = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (candidate.length <= CHUNK_SIZE) {
      currentChunk = candidate;
      continue;
    }

    if (
      currentChunk.length >=
      MINIMUM_CHUNK_LENGTH
    ) {
      chunks.push(currentChunk.trim());
    }

    const overlapText = currentChunk
      .slice(
        Math.max(
          0,
          currentChunk.length -
            CHUNK_OVERLAP
        )
      )
      .trim();

    currentChunk = overlapText
      ? `${overlapText}\n\n${paragraph}`
      : paragraph;
  }

  if (
    currentChunk.length >=
    MINIMUM_CHUNK_LENGTH
  ) {
    chunks.push(currentChunk.trim());
  }

  return chunks
    .map((chunk) => normalizeText(chunk))
    .filter(
      (chunk) =>
        chunk.length >= MINIMUM_CHUNK_LENGTH
    );
}

/* =========================================================
 * 8. 搜尋 PDF 檔案
 * ======================================================= */

async function findPdfFiles(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      const shouldExclude =
        EXCLUDED_FOLDER_PREFIXES.some(
          (prefix) =>
            entry.name.startsWith(prefix)
        );

      if (shouldExclude) {
        console.log(
          `略過資料夾：${entry.name}`
        );

        continue;
      }

      const nestedFiles =
        await findPdfFiles(fullPath);

      files.push(...nestedFiles);

      continue;
    }

    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".pdf")
    ) {
      files.push(fullPath);
    }
  }

  return files.sort((first, second) =>
    first.localeCompare(
      second,
      "zh-Hant",
      {
        numeric: true,
        sensitivity: "base",
      }
    )
  );
}

/* =========================================================
 * 9. PDF 解析
 * ======================================================= */

async function extractPdfText(buffer) {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return normalizeText(result?.text);
  } finally {
    await parser.destroy();
  }
}

/* =========================================================
 * 10. Hugging Face Embedding
 * ======================================================= */

async function createEmbedding(
  content,
  type = "passage"
) {
  const extractor =
    await getEmbeddingPipeline();

  const prefix =
    type === "query"
      ? "query: "
      : "passage: ";

  const output = await extractor(
    `${prefix}${content}`,
    {
      pooling: "mean",
      normalize: true,
    }
  );

  const embedding = Array.from(output.data);

  if (
    !Array.isArray(embedding) ||
    embedding.length === 0
  ) {
    throw new Error(
      "Hugging Face 沒有產生有效 embedding。"
    );
  }

  if (
    embedding.length !==
    EXPECTED_EMBEDDING_DIMENSION
  ) {
    throw new Error(
      [
        "Embedding 維度錯誤。",
        `預期：${EXPECTED_EMBEDDING_DIMENSION}`,
        `實際：${embedding.length}`,
      ].join(" ")
    );
  }

  return embedding;
}

/* =========================================================
 * 11. Supabase 查詢
 * ======================================================= */

async function getExistingDocument(fileHash) {
  const { data, error } = await supabase
    .from("clinical_knowledge_documents")
    .select(
      "id, title, file_name, file_hash"
    )
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (error) {
    throw new Error(
      `檢查重複文件失敗：${error.message}`
    );
  }

  return data;
}

async function isFileAlreadyImported(filePath) {
  const buffer = await fs.readFile(filePath);
  const fileHash = createFileHash(buffer);

  const existingDocument =
    await getExistingDocument(fileHash);

  return Boolean(existingDocument);
}

/* =========================================================
 * 12. 每個分類找一篇尚未匯入的 PDF
 * ======================================================= */

function groupFilesByCategory(files) {
  const groupedFiles = new Map();

  for (const filePath of files) {
    const categoryFolder =
      getCategoryFolder(filePath);

    const isCoreCategory =
      CORE_CATEGORY_PREFIXES.some(
        (prefix) =>
          categoryFolder.startsWith(prefix)
      );

    if (!isCoreCategory) {
      continue;
    }

    if (!groupedFiles.has(categoryFolder)) {
      groupedFiles.set(categoryFolder, []);
    }

    groupedFiles
      .get(categoryFolder)
      .push(filePath);
  }

  return groupedFiles;
}

async function selectNextUnimportedPerCategory(
  allFiles
) {
  const groupedFiles =
    groupFilesByCategory(allFiles);

  const selectedFiles = [];

  const sortedCategories = Array.from(
    groupedFiles.keys()
  ).sort((first, second) =>
    first.localeCompare(
      second,
      "zh-Hant",
      {
        numeric: true,
      }
    )
  );

  for (const categoryFolder of sortedCategories) {
    const categoryFiles =
      groupedFiles.get(categoryFolder) || [];

    let selectedFile = null;

    for (const filePath of categoryFiles) {
      const alreadyImported =
        await isFileAlreadyImported(filePath);

      if (!alreadyImported) {
        selectedFile = filePath;
        break;
      }
    }

    if (selectedFile) {
      selectedFiles.push(selectedFile);

      console.log(
        `分類 ${categoryFolder} 選擇：${path.basename(
          selectedFile
        )}`
      );
    } else {
      console.log(
        `分類 ${categoryFolder} 已沒有尚未匯入的 PDF。`
      );
    }
  }

  return selectedFiles;
}

/* =========================================================
 * 13. 寫入 Supabase
 * ======================================================= */

async function insertDocument({
  filePath,
  fileName,
  fileHash,
  metadata,
}) {
  const relativePath =
    normalizeRelativePath(filePath);

  const title =
    createDocumentTitle(fileName);

  const { data, error } = await supabase
    .from("clinical_knowledge_documents")
    .insert({
      title,
      authors: null,
      publication_year: null,
      journal: null,
      source_url: null,

      file_name: fileName,
      file_path: relativePath,
      file_hash: fileHash,

      document_type: "research_article",
      category: metadata.category,
      game_key: metadata.gameKey,
      ability: metadata.ability,
      population: metadata.population,

      age_min: null,
      age_max: null,
      evidence_level: "unknown",

      is_core: metadata.isCore,
      is_active: true,
      requires_review: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `建立論文資料失敗：${error.message}`
    );
  }

  if (!data?.id) {
    throw new Error(
      "建立論文後沒有取得 document id。"
    );
  }

  return data.id;
}

async function insertChunk({
  documentId,
  documentTitle,
  chunkIndex,
  content,
  metadata,
}) {
  const embeddingInput = [
    `文件標題：${documentTitle}`,
    `遊戲分類：${metadata.gameKey}`,
    `能力分類：${metadata.ability}`,
    `適用族群：${metadata.population}`,
    "",
    content,
  ].join("\n");

  const embedding = await createEmbedding(
    embeddingInput,
    "passage"
  );

  const { error } = await supabase
    .from("clinical_knowledge_chunks")
    .insert({
      document_id: documentId,
      chunk_index: chunkIndex,
      content,

      page_number: null,
      section_title: null,

      category: metadata.category,
      game_key: metadata.gameKey,
      ability: metadata.ability,
      population: metadata.population,

      token_count: null,
      embedding,
    });

  if (error) {
    throw new Error(
      `第 ${chunkIndex + 1} 段寫入失敗：${error.message}`
    );
  }
}

async function deleteDocument(documentId) {
  const { error } = await supabase
    .from("clinical_knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    console.error(
      `清除未完成文件失敗：${error.message}`
    );
  }
}

/* =========================================================
 * 14. 匯入單篇 PDF
 * ======================================================= */

async function importPdf(filePath) {
  const fileName = path.basename(filePath);

  const documentTitle =
    createDocumentTitle(fileName);

  const metadata =
    inferMetadata(filePath);

  console.log(
    "\n========================================"
  );

  console.log(`正在處理：${fileName}`);
  console.log(`分類：${metadata.category}`);
  console.log(`遊戲：${metadata.gameKey}`);
  console.log(`能力：${metadata.ability}`);
  console.log(`族群：${metadata.population}`);

  const buffer = await fs.readFile(filePath);
  const fileHash = createFileHash(buffer);

  const existingDocument =
    await getExistingDocument(fileHash);

  if (existingDocument) {
    console.log(
      `略過重複文件：${existingDocument.file_name}`
    );

    return {
      status: "duplicate",
      fileName,
      chunkCount: 0,
    };
  }

  let text;

  try {
    text = await extractPdfText(buffer);
  } catch (error) {
    console.warn(
      [
        `PDF 解析失敗：${fileName}`,
        `原因：${error.message}`,
      ].join("\n")
    );

    return {
      status: "parse_failed",
      fileName,
      chunkCount: 0,
    };
  }

  if (
    !text ||
    text.length <
      MINIMUM_DOCUMENT_TEXT_LENGTH
  ) {
    console.warn(
      [
        `略過：${fileName}`,
        `只能擷取 ${text?.length || 0} 個字元。`,
        "可能是掃描型 PDF。",
      ].join(" ")
    );

    return {
      status: "insufficient_text",
      fileName,
      chunkCount: 0,
    };
  }

  const chunks =
    splitTextIntoChunks(text);

  if (chunks.length === 0) {
    console.warn(
      `略過：${fileName} 沒有有效段落。`
    );

    return {
      status: "no_chunks",
      fileName,
      chunkCount: 0,
    };
  }

  console.log(
    `文字長度：${text.length} 字元`
  );

  console.log(
    `共切成：${chunks.length} 段`
  );

  let documentId = null;

  try {
    documentId = await insertDocument({
      filePath,
      fileName,
      fileHash,
      metadata,
    });

    for (
      let index = 0;
      index < chunks.length;
      index += 1
    ) {
      await insertChunk({
        documentId,
        documentTitle,
        chunkIndex: index,
        content: chunks[index],
        metadata,
      });

      console.log(
        `已匯入 ${index + 1}/${chunks.length}`
      );
    }

    console.log(`完成：${fileName}`);

    return {
      status: "success",
      fileName,
      chunkCount: chunks.length,
    };
  } catch (error) {
    if (documentId) {
      await deleteDocument(documentId);
    }

    throw new Error(
      `${fileName} 匯入失敗：${error.message}`
    );
  }
}

/* =========================================================
 * 15. 選擇本次要匯入的 PDF
 * ======================================================= */

async function selectFilesForImport(
  allPdfFiles
) {
  const importLimit = parseImportLimit();

  if (IMPORT_MODE === "all") {
    if (importLimit === 0) {
      return allPdfFiles;
    }

    return allPdfFiles.slice(
      0,
      importLimit
    );
  }

  const selectedFiles =
    await selectNextUnimportedPerCategory(
      allPdfFiles
    );

  if (importLimit === 0) {
    return selectedFiles;
  }

  return selectedFiles.slice(
    0,
    importLimit
  );
}

/* =========================================================
 * 16. 主程式
 * ======================================================= */

async function main() {
  console.log(
    "========================================"
  );

  console.log(
    "RAG 專業知識庫匯入程式"
  );

  console.log(
    "========================================"
  );

  console.log(
    `知識庫路徑：${KNOWLEDGE_DIRECTORY}`
  );

  console.log(
    `Embedding 模型：${HUGGINGFACE_EMBEDDING_MODEL}`
  );

  console.log(
    `Embedding 維度：${EXPECTED_EMBEDDING_DIMENSION}`
  );

  console.log(
    `匯入模式：${IMPORT_MODE}`
  );

  try {
    await fs.access(KNOWLEDGE_DIRECTORY);
  } catch {
    throw new Error(
      `找不到 knowledge_base：${KNOWLEDGE_DIRECTORY}`
    );
  }

  const allPdfFiles =
    await findPdfFiles(KNOWLEDGE_DIRECTORY);

  if (allPdfFiles.length === 0) {
    console.log("沒有找到 PDF。");
    return;
  }

  console.log(
    `總共找到 ${allPdfFiles.length} 份 PDF。`
  );

  const pdfFiles =
    await selectFilesForImport(allPdfFiles);

  if (pdfFiles.length === 0) {
    console.log(
      "目前沒有符合條件且尚未匯入的 PDF。"
    );

    return;
  }

  console.log(
    `本次將處理 ${pdfFiles.length} 份 PDF。`
  );

  const summary = {
    success: 0,
    duplicate: 0,
    parseFailed: 0,
    insufficientText: 0,
    noChunks: 0,
    failed: 0,
    totalChunks: 0,
  };

  for (
    let index = 0;
    index < pdfFiles.length;
    index += 1
  ) {
    const filePath = pdfFiles[index];

    console.log(
      `\n整體進度：${index + 1}/${pdfFiles.length}`
    );

    try {
      const result =
        await importPdf(filePath);

      switch (result.status) {
        case "success":
          summary.success += 1;
          summary.totalChunks +=
            result.chunkCount;
          break;

        case "duplicate":
          summary.duplicate += 1;
          break;

        case "parse_failed":
          summary.parseFailed += 1;
          break;

        case "insufficient_text":
          summary.insufficientText += 1;
          break;

        case "no_chunks":
          summary.noChunks += 1;
          break;

        default:
          break;
      }
    } catch (error) {
      summary.failed += 1;

      console.error(
        "\n========================================"
      );

      console.error("匯入錯誤");

      console.error(
        "========================================"
      );

      console.error(`檔案：${filePath}`);

      console.error(
        `錯誤名稱：${error?.name || "UnknownError"}`
      );

      console.error(
        `錯誤訊息：${error?.message || error}`
      );

      console.error(error);

      // 發生錯誤就停止，避免連續錯誤。
      break;
    }
  }

  console.log(
    "\n========================================"
  );

  console.log("全部處理完成");

  console.log(
    "========================================"
  );

  console.log(
    `成功匯入：${summary.success} 份`
  );

  console.log(
    `產生段落：${summary.totalChunks} 段`
  );

  console.log(
    `重複略過：${summary.duplicate} 份`
  );

  console.log(
    `PDF 解析失敗：${summary.parseFailed} 份`
  );

  console.log(
    `文字不足：${summary.insufficientText} 份`
  );

  console.log(
    `無有效段落：${summary.noChunks} 份`
  );

  console.log(
    `其他失敗：${summary.failed} 份`
  );
}

main().catch((error) => {
  console.error(
    "\n程式執行失敗："
  );

  console.error(error);

  process.exitCode = 1;
});