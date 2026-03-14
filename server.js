const express = require("express");
const lti = require("ltijs").Provider;
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PORT = process.env.PORT || 3000;

// -----------------------------
// Generic helpers
// -----------------------------
function getClaim(obj, key, fallback = {}) {
  return obj?.[key] || fallback;
}

function normalizeCourseId(value) {
  if (!value) return null;
  const str = String(value);
  if (/^\d+$/.test(str)) return str;
  const match = str.match(/(\d+)/);
  return match ? match[1] : null;
}

function buildCanvasBaseUrl(token, req) {
  if (token?.iss && /^https?:\/\//i.test(token.iss)) return token.iss;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}

function fileNameFromHeaders(headers, fallback) {
  const cd = headers.get("content-disposition") || "";
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = cd.match(/filename="?([^"]+)"?/i);
  if (plain) return plain[1];
  return fallback;
}

// -----------------------------
// Canvas REST API helpers
// -----------------------------
async function canvasFetch(canvasBaseUrl, path, options = {}) {
  if (!process.env.CANVAS_API_TOKEN) {
    throw new Error("Missing CANVAS_API_TOKEN");
  }

  const url = `${canvasBaseUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${process.env.CANVAS_API_TOKEN}`,
    ...(options.headers || {})
  };

  return fetch(url, { ...options, headers });
}

async function canvasJson(canvasBaseUrl, path, options = {}) {
  const res = await canvasFetch(canvasBaseUrl, path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API error ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

async function getCourseRootFolderId(canvasBaseUrl, courseId) {
  const folder = await canvasJson(canvasBaseUrl, `/api/v1/courses/${courseId}/folders/root`);
  return folder.id;
}

async function uploadBufferToCanvas(canvasBaseUrl, courseId, filename, buffer, contentType) {
  console.log("CANVAS UPLOAD START:", { courseId, filename, contentType, size: buffer.length });

  const rootFolderId = await getCourseRootFolderId(canvasBaseUrl, courseId);
  console.log("CANVAS ROOT FOLDER ID:", rootFolderId);

  const formBody = new URLSearchParams();
  formBody.set("name", filename);
  formBody.set("size", String(buffer.length));
  formBody.set("content_type", contentType || "application/octet-stream");
  formBody.set("on_duplicate", "rename");

  const initRes = await canvasFetch(
    canvasBaseUrl,
    `/api/v1/folders/${rootFolderId}/files`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formBody.toString()
    }
  );

  const initText = await initRes.text();

  if (!initRes.ok) {
    throw new Error(`Canvas upload init failed: ${initRes.status} ${initText}`);
  }

  let initJson;
  try {
    initJson = JSON.parse(initText);
  } catch {
    throw new Error(`Canvas upload init response was not JSON: ${initText}`);
  }

  const uploadUrl = initJson.upload_url;
  const uploadParams = initJson.upload_params || {};

  if (!uploadUrl) {
    throw new Error("Canvas upload_url missing");
  }

  const fd = new FormData();
  Object.entries(uploadParams).forEach(([k, v]) => fd.append(k, v));
  fd.append("file", new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    body: fd,
    redirect: "follow"
  });

  const uploadText = await uploadRes.text();

  if (!uploadRes.ok) {
    throw new Error(`Canvas upload POST failed: ${uploadRes.status} ${uploadText}`);
  }

  let uploaded;
  try {
    uploaded = JSON.parse(uploadText);
  } catch {
    throw new Error(`Canvas upload response was not JSON: ${uploadText}`);
  }

  console.log("CANVAS UPLOAD COMPLETE:", {
    id: uploaded?.id,
    display_name: uploaded?.display_name,
    url: uploaded?.url
  });

  return uploaded;
}

function buildCanvasHostedHtml(file, title, lessonTitle, unitTitle) {
  const fileUrl = file.url;
  const fileId = file.id;
  const displayName = file.display_name || file.filename || title;
  const contentType = file["content-type"] || file.content_type || "";
  const lowerName = displayName.toLowerCase();

  if (contentType.startsWith("video/")) {
    return `
<section>
  <h2>${title}</h2>
  <p><strong>Lesson:</strong> ${lessonTitle || "Oak lesson"}</p>
  <p><strong>Unit:</strong> ${unitTitle || "Oak unit"}</p>
  <div style="margin-top:12px;">
    <video controls preload="metadata" style="width:100%; max-width:100%; border-radius:12px; background:#000;">
      <source src="${fileUrl}">
      Your browser does not support embedded video.
    </video>
  </div>
</section>
    `.trim();
  }

  if (contentType.includes("pdf") || lowerName.endsWith(".pdf")) {
    return `
<section>
  <h2>${title}</h2>
  <p><strong>Lesson:</strong> ${lessonTitle || "Oak lesson"}</p>
  <p><strong>Unit:</strong> ${unitTitle || "Oak unit"}</p>
  <div style="margin-top:12px; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; background:#fff;">
    <iframe
      src="${fileUrl}"
      title="${title}"
      style="width:100%; height:520px; border:0;"
      loading="lazy">
    </iframe>
  </div>
  <p style="margin-top:10px;">
    <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">Open ${displayName}</a>
  </p>
</section>
    `.trim();
  }

  return `
<section>
  <h2>${title}</h2>
  <p><strong>Lesson:</strong> ${lessonTitle || "Oak lesson"}</p>
  <p><strong>Unit:</strong> ${unitTitle || "Oak unit"}</p>
  <p>
    <a
      class="instructure_file_link instructure_scribd_file inline_disabled"
      href="${fileUrl}"
      target="_blank"
      rel="noopener noreferrer"
      data-canvas-previewable="true"
      data-file-id="${fileId}">
      ${displayName}
    </a>
  </p>
</section>
  `.trim();
}

// -----------------------------
// Oak helpers
// -----------------------------
async function oakFetch(path, options = {}) {
  const res = await fetch(`https://open-api.thenational.academy/api/v0${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.OAK_API_KEY}`
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Oak API error: ${res.status} on ${path}: ${text}`);
  }

  return res;
}

async function oakFetchJson(path) {
  const res = await oakFetch(path);
  return res.json();
}

function mapToOakSubject(subject) {
  if (!subject) return null;

  const s = subject.trim().toLowerCase();

  if (["math", "maths", "mathematics"].includes(s)) return "maths";
  if (["ela", "english language arts", "english"].includes(s)) return "english";
  if (s === "science") return "science";
  if (s === "social studies") return "history";

  return null;
}

function mapGradeToOakKeyStage(year) {
  if (!year) return null;

  const match = String(year).match(/(\d+)/);
  if (!match) return null;

  const grade = Number(match[1]);

  if (grade >= 1 && grade <= 2) return "ks1";
  if (grade >= 3 && grade <= 6) return "ks2";
  if (grade >= 7 && grade <= 9) return "ks3";
  if (grade >= 10 && grade <= 11) return "ks4";

  return null;
}

function normalizeLessonList(lessonData) {
  if (!lessonData) return [];

  if (Array.isArray(lessonData)) {
    if (lessonData.length && Array.isArray(lessonData[0].lessons)) {
      return lessonData.flatMap(unit => unit.lessons || []);
    }
    return lessonData;
  }

  if (Array.isArray(lessonData.lessons)) return lessonData.lessons;
  if (Array.isArray(lessonData.data)) return lessonData.data;
  if (Array.isArray(lessonData.results)) return lessonData.results;

  if (Array.isArray(lessonData.units)) {
    return lessonData.units.flatMap(unit => unit.lessons || []);
  }

  return [];
}

function assetTitle(type) {
  if (type === "slideDeck") return "Oak Slide Deck";
  if (type === "video") return "Oak Lesson Video";
  return "Oak Resource";
}

async function fetchOakAssetToCanvasChunk(canvasBaseUrl, courseId, lessonSlug, lessonTitle, unitTitle, type) {
  try {
    console.log(`OAK ASSET START: ${lessonSlug} (${type})`);
    console.log("CANVAS BASE URL:", canvasBaseUrl);
    console.log("COURSE ID:", courseId);
    console.log("HAS CANVAS TOKEN:", Boolean(process.env.CANVAS_API_TOKEN));

    const assetRes = await oakFetch(`/lessons/${lessonSlug}/assets/${type}`);
    const contentType = assetRes.headers.get("content-type") || "application/octet-stream";

    const fallbackName =
      type === "video"
        ? `${lessonSlug}-oak-video.mp4`
        : `${lessonSlug}-oak-slide-deck`;

    const filename = fileNameFromHeaders(assetRes.headers, fallbackName);
    console.log(`OAK ASSET FILENAME (${type}):`, filename);
    console.log(`OAK ASSET CONTENT TYPE (${type}):`, contentType);

    const buffer = Buffer.from(await assetRes.arrayBuffer());
    console.log(`OAK ASSET BUFFER SIZE (${type}):`, buffer.length);

    const uploadedFile = await uploadBufferToCanvas(
      canvasBaseUrl,
      courseId,
      filename,
      buffer,
      contentType
    );

    console.log(`CANVAS UPLOAD SUCCESS (${type}):`, uploadedFile?.id, uploadedFile?.display_name, uploadedFile?.url);

    return {
      title: assetTitle(type),
      html: buildCanvasHostedHtml(uploadedFile, assetTitle(type), lessonTitle, unitTitle)
    };
  } catch (err) {
    console.error(`OAK ASSET UPLOAD FAILED (${type}) for ${lessonSlug}:`, err.message);
    return null;
  }
}

async function buildOakBundle(subject, year, canvasBaseUrl, courseId) {
  const oakSubject = mapToOakSubject(subject);
  const oakKeyStage = mapGradeToOakKeyStage(year);

  console.log("OAK INPUT SUBJECT:", subject);
  console.log("OAK INPUT YEAR:", year);
  console.log("OAK MAPPED SUBJECT:", oakSubject);
  console.log("OAK MAPPED KEY STAGE:", oakKeyStage);

  if (!oakSubject || !oakKeyStage) {
    console.log("OAK MAPPING FAILED");
    return { used: false, context: "No Oak context available.", extraChunks: [] };
  }

  try {
    const path = `/key-stages/${oakKeyStage}/subject/${oakSubject}/lessons`;
    console.log("OAK REQUEST PATH:", path);

    const lessonData = await oakFetchJson(path);

    console.log("OAK RAW RESPONSE TYPE:", Array.isArray(lessonData) ? "array" : typeof lessonData);
    console.log("OAK RAW RESPONSE SAMPLE:", JSON.stringify(lessonData).slice(0, 1200));

    const lessons = normalizeLessonList(lessonData);
    console.log("OAK PARSED LESSON COUNT:", lessons.length);

    const selectedLessons = lessons
      .map(l => ({
        lessonSlug: l.lessonSlug || l.slug,
        lessonTitle: l.lessonTitle || l.title || "Untitled lesson",
        unitTitle: l.unitTitle || l.unitTitleDisplay || l.unit || "Unknown unit"
      }))
      .filter(l => l.lessonSlug)
      .slice(0, 2);

    console.log("OAK LESSON SLUGS:", selectedLessons.map(l => l.lessonSlug));

    if (!selectedLessons.length) {
      return { used: false, context: "No Oak context available.", extraChunks: [] };
    }

    const summaries = [];

    for (const lesson of selectedLessons) {
      try {
        const summary = await oakFetchJson(`/lessons/${lesson.lessonSlug}/summary`);
        console.log("OAK SUMMARY SUCCESS FOR:", lesson.lessonSlug);
        summaries.push({ lesson, summary });
      } catch (err) {
        console.error("OAK SUMMARY FAILED FOR:", lesson.lessonSlug, err.message);
      }
    }

    if (!summaries.length) {
      return { used: false, context: "No Oak context available.", extraChunks: [] };
    }

    const context = summaries.map(({ lesson, summary }, index) => {
      const lessonTitle = summary.lessonTitle || lesson.lessonTitle || "Untitled lesson";
      const unitTitle = summary.unitTitle || lesson.unitTitle || "Unknown unit";

      const keyLearningPoints = (summary.keyLearningPoints || [])
        .map(item => item.keyLearningPoint || item)
        .filter(Boolean)
        .slice(0, 3);

      const misconceptions = (summary.misconceptionsAndCommonMistakes || [])
        .map(item => item.misconception || item)
        .filter(Boolean)
        .slice(0, 2);

      return `
Lesson ${index + 1}: ${lessonTitle}
Unit: ${unitTitle}
Key learning points:
${keyLearningPoints.length ? keyLearningPoints.map(p => `- ${p}`).join("\n") : "- None provided"}
Common misconceptions:
${misconceptions.length ? misconceptions.map(m => `- ${m}`).join("\n") : "- None provided"}
      `.trim();
    }).join("\n\n");

    const extraChunks = [];

    if (canvasBaseUrl && courseId) {
      for (const { lesson } of summaries) {
        if (!extraChunks.find(c => c.title === "Oak Slide Deck")) {
          const slideChunk = await fetchOakAssetToCanvasChunk(
            canvasBaseUrl,
            courseId,
            lesson.lessonSlug,
            lesson.lessonTitle,
            lesson.unitTitle,
            "slideDeck"
          );
          if (slideChunk) extraChunks.push(slideChunk);
        }

        if (!extraChunks.find(c => c.title === "Oak Lesson Video")) {
          const videoChunk = await fetchOakAssetToCanvasChunk(
            canvasBaseUrl,
            courseId,
            lesson.lessonSlug,
            lesson.lessonTitle,
            lesson.unitTitle,
            "video"
          );
          if (videoChunk) extraChunks.push(videoChunk);
        }

        if (
          extraChunks.find(c => c.title === "Oak Slide Deck") &&
          extraChunks.find(c => c.title === "Oak Lesson Video")
        ) {
          break;
        }
      }
    } else {
      console.log("SKIPPING OAK ASSET UPLOAD: missing canvasBaseUrl or courseId");
    }

    console.log("OAK EXTRA CHUNKS:", extraChunks.map(c => c.title));

    return {
      used: true,
      context,
      extraChunks
    };
  } catch (err) {
    console.error("Oak context build failed:", err.message);
    return { used: false, context: "No Oak context available.", extraChunks: [] };
  }
}

// -----------------------------
// LTI setup
// -----------------------------
lti.setup(
  process.env.LTI_KEY || "super-secret-lti-key-change-me",
  { url: process.env.DATABASE_URL },
  {
    appRoute: "/",
    loginRoute: "/lti/login",
    redirectUri: "/lti/launch",
    devMode: true
  }
);

// -----------------------------
// Deep linking UI
// -----------------------------
lti.onDeepLinking(async (token, req, res) => {
  const contextClaim = getClaim(token, "https://purl.imsglobal.org/spec/lti/claim/context", {});
  const courseId = normalizeCourseId(contextClaim.id);
  const canvasBaseUrl = buildCanvasBaseUrl(token, req);

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>AI Curriculum Builder</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #0f172a; padding: 24px; }
    .shell { max-width: 1040px; margin: 0 auto; }
    .card { background: rgba(255,255,255,.96); border: 1px solid #e2e8f0; border-radius: 22px; box-shadow: 0 20px 50px rgba(15,23,42,.08); overflow: hidden; }
    .header { padding: 28px 30px 18px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #fff 0%, #f8fafc 100%); }
    .eyebrow { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
    h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.1; }
    .subtext { margin: 0; color: #475569; font-size: 14px; line-height: 1.5; max-width: 860px; }
    .content { padding: 24px 30px 30px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .field-full { grid-column: 1 / -1; }
    .field label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
    .field input, .field textarea, .field select { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px 16px; font-size: 15px; color: #0f172a; background: #fff; outline: none; transition: all .18s ease; }
    .field input:focus, .field textarea:focus, .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,.12); }
    .field textarea { min-height: 140px; resize: vertical; }
    .field-help { margin-top: 6px; font-size: 12px; color: #64748b; }
    .inline-three { display: flex; gap: 16px; flex-wrap: nowrap; }
    .inline-three .field { flex: 1; margin-bottom: 0; }
    .inline-three .field:first-child { flex: 1.6; }
    .button-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .bottom-actions { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; flex-wrap: wrap; margin-top: 22px; padding-top: 18px; border-top: 1px solid #e2e8f0; }
    .translation-panel { flex: 1 1 420px; display: flex; flex-direction: column; gap: 12px; }
    .translation-toggle { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #0f172a; }
    .translation-options { display: none; max-width: 360px; }
    .translation-options.active { display: block; }
    button { appearance: none; border: none; border-radius: 14px; padding: 13px 18px; font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: .6; cursor: wait; transform: none; }
    .primary { background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); color: white; box-shadow: 0 10px 20px rgba(37,99,235,.18); }
    .secondary { background: #0f172a; color: white; box-shadow: 0 10px 20px rgba(15,23,42,.14); }
    .ghost { background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; }
    .status { min-height: 20px; font-size: 13px; color: #475569; margin-bottom: 16px; }
    .status.error { color: #b91c1c; }
    .preview-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .preview-title-wrap { display: flex; align-items: center; gap: 10px; }
    .preview-title { font-size: 15px; font-weight: 700; }
    .oak-indicator { width: 12px; height: 12px; border-radius: 999px; background: #cbd5e1; box-shadow: inset 0 0 0 1px rgba(15,23,42,.08); }
    .oak-indicator.active { background: #16a34a; box-shadow: 0 0 0 4px rgba(22,163,74,.12); }
    .oak-label { font-size: 12px; color: #64748b; }
    .select-all-wrap { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
    .chunks { display: grid; gap: 14px; margin-bottom: 18px; }
    .chunk-card { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #fff 0%, #f8fbff 100%); overflow: hidden; }
    .chunk-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #eff6ff; }
    .chunk-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .chunk-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; white-space: nowrap; }
    .chunk-body { padding: 18px; }
    .chunk-body section { border-left: 4px solid #93c5fd; padding-left: 14px; }
    .chunk-body h1, .chunk-body h2, .chunk-body h3, .chunk-body h4, .chunk-body h5 { margin-top: 0; color: #0f172a; }
    .chunk-body p { line-height: 1.6; }
    .chunk-body ul, .chunk-body ol { padding-left: 22px; line-height: 1.6; }
    .empty-preview { border: 1px dashed #cbd5e1; border-radius: 16px; padding: 20px; color: #64748b; background: #fff; }
    .loading { display: inline-flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; opacity: .4; animation: pulse 1s infinite ease-in-out; }
    .dot:nth-child(2) { animation-delay: .15s; }
    .dot:nth-child(3) { animation-delay: .3s; }
    .helper-note { font-size: 13px; color: #64748b; }
    @keyframes pulse { 0%,100% { opacity:.25; transform:translateY(0); } 50% { opacity:1; transform:translateY(-2px); } }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
      .inline-three { flex-wrap: wrap; }
      .bottom-actions { align-items: stretch; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <div class="header">
        <div class="eyebrow">Canvas + AI + Oak</div>
        <h1>AI Curriculum Builder</h1>
        <p class="subtext">When available, Oak resources are uploaded into Canvas so they can preview and embed as Canvas-hosted assets.</p>
      </div>

      <div class="content">
        <div class="form-grid">
          <div class="field">
            <label for="itemType">What are you creating?</label>
            <select id="itemType">
              <option value="Content Page">Content Page</option>
              <option value="Assignment">Assignment</option>
              <option value="Discussion">Discussion</option>
              <option value="Quiz Directions">Quiz Directions</option>
              <option value="Quiz Question">Quiz Question</option>
            </select>
          </div>

          <div class="field">
            <label for="supportLevel">Audience / Support level</label>
            <select id="supportLevel">
              <option value="Tier 1: Core Instruction for All Students">Tier 1: Core Instruction for All Students</option>
              <option value="Tier 2: Targeted Interventions for Small Groups">Tier 2: Targeted Interventions for Small Groups</option>
              <option value="Tier 3: Intensive Support for Individuals">Tier 3: Intensive Support for Individuals</option>
              <option disabled>────────────</option>
              <option value="IEP Support: Translation">IEP Support: Translation</option>
              <option value="IEP Support: Scaffolded">IEP Support: Scaffolded</option>
            </select>
          </div>

          <div class="field field-full">
            <div class="inline-three">
              <div class="field">
                <label for="standard">Standard</label>
                <input id="standard" placeholder="Ex: 6.RP.A.1" onblur="autoFillStandardMeta()" />
              </div>

              <div class="field">
                <label for="subject">Subject</label>
                <input id="subject" placeholder="Auto-filled from standard" />
              </div>

              <div class="field">
                <label for="year">Year / Grade</label>
                <input id="year" placeholder="Auto-filled from standard" />
              </div>
            </div>
            <div class="field-help">When recognized, the tool will auto-fill subject and year/grade. You can still edit them manually.</div>
          </div>

          <div class="field field-full">
            <label for="prompt">Teacher Prompt</label>
            <textarea id="prompt" placeholder="Ex: Create a student-facing content page with an overview, vocabulary, worked examples, and a quick check for understanding."></textarea>
          </div>
        </div>

        <div class="button-row">
          <button id="generateBtn" class="primary" onclick="generate()">Generate</button>
          <button class="ghost" onclick="clearPreview()">Clear</button>
        </div>

        <div id="status" class="status"></div>

        <div class="preview-header">
          <div class="preview-title-wrap">
            <div class="preview-title">Preview</div>
            <div id="oakIndicator" class="oak-indicator"></div>
            <div id="oakLabel" class="oak-label">Oak not used</div>
          </div>

          <label class="select-all-wrap">
            <input type="checkbox" id="selectAll" onchange="toggleAllChunks(this.checked)" />
            Select all
          </label>
        </div>

        <div id="chunks" class="chunks"></div>
        <div id="emptyPreview" class="empty-preview">Nothing generated yet.</div>

        <div class="bottom-actions">
          <div class="translation-panel">
            <label class="translation-toggle">
              <input type="checkbox" id="translateBeforeInsert" onchange="toggleTranslationOptions()" />
              Translate selected content before inserting
            </label>

            <div id="translationOptions" class="translation-options">
              <div class="field">
                <label for="translationLanguage">Translation language</label>
                <select id="translationLanguage">
                  <option value="Spanish">Spanish</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Mandarin Chinese (Simplified)">Mandarin Chinese (Simplified)</option>
                  <option value="Haitian Creole">Haitian Creole</option>
                  <option value="Vietnamese">Vietnamese</option>
                </select>
              </div>
            </div>

            <div class="helper-note">Only checked sections will be inserted into Canvas.</div>
          </div>

          <button id="insertBtn" class="secondary" onclick="insertIntoCanvas()">Insert Checked Into Canvas</button>
        </div>
      </div>
    </div>
  </div>

<script>
  const ltik = new URLSearchParams(window.location.search).get("ltik");
  const courseId = ${JSON.stringify(courseId)};
  const canvasBaseUrl = ${JSON.stringify(canvasBaseUrl)};

  const generateBtn = document.getElementById("generateBtn");
  const insertBtn = document.getElementById("insertBtn");
  const statusEl = document.getElementById("status");
  const chunksEl = document.getElementById("chunks");
  const emptyPreviewEl = document.getElementById("emptyPreview");
  const selectAllEl = document.getElementById("selectAll");
  const translateCheckboxEl = document.getElementById("translateBeforeInsert");
  const translationOptionsEl = document.getElementById("translationOptions");
  const oakIndicatorEl = document.getElementById("oakIndicator");
  const oakLabelEl = document.getElementById("oakLabel");

  let generatedChunks = [];

  function setStatus(message, isError = false) {
    statusEl.textContent = message || "";
    statusEl.className = isError ? "status error" : "status";
  }

  function setLoading(button, isLoading, label) {
    if (isLoading) {
      button.disabled = true;
      button.innerHTML = '<span class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
    } else {
      button.disabled = false;
      button.textContent = label;
    }
  }

  function setOakIndicator(used) {
    if (used) {
      oakIndicatorEl.classList.add("active");
      oakLabelEl.textContent = "Oak used";
    } else {
      oakIndicatorEl.classList.remove("active");
      oakLabelEl.textContent = "Oak not used";
    }
  }

  function toggleTranslationOptions() {
    translationOptionsEl.classList.toggle("active", translateCheckboxEl.checked);
  }

  async function autoFillStandardMeta() {
    const standard = document.getElementById("standard").value.trim();
    if (!standard || standard.length < 3) return;

    try {
      setStatus("Detecting subject and grade from standard...");
      const res = await fetch("/detect-standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standard, ltik })
      });
      const data = await res.json();
      if (data.subject) document.getElementById("subject").value = data.subject;
      if (data.grade) document.getElementById("year").value = data.grade;
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("");
    }
  }

  function clearPreview() {
    generatedChunks = [];
    chunksEl.innerHTML = "";
    emptyPreviewEl.style.display = "block";
    emptyPreviewEl.textContent = "Nothing generated yet.";
    selectAllEl.checked = false;
    setOakIndicator(false);
    setStatus("");
  }

  function renderChunks() {
    chunksEl.innerHTML = "";

    if (!generatedChunks.length) {
      emptyPreviewEl.style.display = "block";
      emptyPreviewEl.textContent = "Nothing generated yet.";
      return;
    }

    emptyPreviewEl.style.display = "none";

    generatedChunks.forEach((chunk, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "chunk-card";
      wrapper.innerHTML = \`
        <div class="chunk-top">
          <div class="chunk-title">\${chunk.title || "Generated Content " + (index + 1)}</div>
          <label class="chunk-check">
            <span>Check</span>
            <input type="checkbox" \${chunk.selected ? "checked" : ""} onchange="toggleChunk(\${index}, this.checked)" />
          </label>
        </div>
        <div class="chunk-body">\${chunk.html || ""}</div>
      \`;
      chunksEl.appendChild(wrapper);
    });

    updateSelectAllState();
  }

  function toggleChunk(index, checked) {
    generatedChunks[index].selected = checked;
    updateSelectAllState();
  }

  function toggleAllChunks(checked) {
    generatedChunks = generatedChunks.map(chunk => ({ ...chunk, selected: checked }));
    renderChunks();
  }

  function updateSelectAllState() {
    selectAllEl.checked = generatedChunks.length > 0 && generatedChunks.every(chunk => chunk.selected);
  }

  async function generate() {
    const itemType = document.getElementById("itemType").value;
    const supportLevel = document.getElementById("supportLevel").value;
    const standard = document.getElementById("standard").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const year = document.getElementById("year").value.trim();
    const prompt = document.getElementById("prompt").value.trim();

    if (!itemType || !supportLevel || !standard || !subject || !year || !prompt) {
      setStatus("Please complete all fields before generating.", true);
      return;
    }

    try {
      setStatus("Generating chunked content...");
      setLoading(generateBtn, true, "Generate");
      setOakIndicator(false);

      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType, supportLevel, standard, subject, year, prompt, ltik, courseId, canvasBaseUrl
        })
      });

      const parsed = await res.json();

      if (!res.ok) {
        setStatus("Generate failed. Check your server logs.", true);
        emptyPreviewEl.style.display = "block";
        emptyPreviewEl.textContent = "Generation failed.";
        return;
      }

      generatedChunks = (parsed.chunks || []).map(chunk => ({
        title: chunk.title,
        html: chunk.html,
        selected: false
      }));

      renderChunks();
      setOakIndicator(Boolean(parsed.oakUsed));
      setStatus("Content generated successfully.");
    } catch (err) {
      console.error(err);
      setStatus("Generate failed. Please try again.", true);
      emptyPreviewEl.style.display = "block";
      emptyPreviewEl.textContent = "Generation failed.";
      setOakIndicator(false);
    } finally {
      setLoading(generateBtn, false, "Generate");
    }
  }

  async function insertIntoCanvas() {
    const selectedChunks = generatedChunks.filter(chunk => chunk.selected);
    if (!selectedChunks.length) {
      setStatus("Please check at least one content chunk to insert.", true);
      return;
    }

    let html = selectedChunks.map(chunk => chunk.html).join("\\n<hr />\\n");

    try {
      setStatus("Preparing content for Canvas...");
      setLoading(insertBtn, true, "Insert Checked Into Canvas");

      if (translateCheckboxEl.checked) {
        const language = document.getElementById("translationLanguage").value;
        setStatus("Translating selected content to " + language + "...");

        const translateRes = await fetch("/translate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, language, ltik })
        });

        if (!translateRes.ok) {
          setStatus("Translation failed. Check your server logs.", true);
          return;
        }

        html = await translateRes.text();
      }

      setStatus("Sending selected content back to Canvas...");

      const res = await fetch("/return-deeplink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, ltik })
      });

      const page = await res.text();

      if (!res.ok) {
        setStatus("Insert failed. Check your server logs.", true);
        return;
      }

      document.open();
      document.write(page);
      document.close();
    } catch (err) {
      console.error(err);
      setStatus("Insert failed. Please try again.", true);
    } finally {
      setLoading(insertBtn, false, "Insert Checked Into Canvas");
    }
  }
</script>
</body>
</html>
  `);
});

// -----------------------------
// Deploy routes
// -----------------------------
lti.deploy({ port: PORT }).then(async () => {
  const app = lti.app;

  await lti.registerPlatform({
    url: "https://canvas.instructure.com",
    name: "Canvas",
    clientId: "131630000000000243",
    authenticationEndpoint: "https://sso.canvaslms.com/api/lti/authorize_redirect",
    accesstokenEndpoint: "https://cclayton.instructure.com/login/oauth2/token",
    authConfig: {
      method: "JWK_SET",
      key: "https://cclayton.instructure.com/api/lti/security/jwks"
    }
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    res.send("Canvas Deep Link Builder is running.");
  });

  app.post("/detect-standard", async (req, res) => {
    try {
      const { standard } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You identify the subject and grade level of academic standards.
Return JSON only in this exact format:
{
  "subject": "Math | ELA | Science | Social Studies | Other",
  "grade": "Grade X | Kindergarten | Unknown"
}`
          },
          { role: "user", content: standard }
        ]
      });

      res.json(JSON.parse(completion.choices[0].message.content));
    } catch (err) {
      console.error(err);
      res.status(500).json({});
    }
  });

  app.post("/generate", async (req, res) => {
    try {
      const { itemType, supportLevel, standard, subject, year, prompt, courseId, canvasBaseUrl } = req.body;

      console.log("GENERATE COURSE ID:", courseId);
      console.log("GENERATE CANVAS BASE URL:", canvasBaseUrl);

      const oakResult = await buildOakBundle(subject, year, canvasBaseUrl, courseId);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You create standards-aligned content for Canvas LMS.

Return ONLY valid JSON in this exact shape:
{
  "chunks": [
    { "title": "Short chunk title", "html": "<section>...</section>" }
  ]
}

Rules:
- Return exactly 3 chunks.
- Use semantic HTML only: section, h2, h3, p, ul, ol, li, strong, em, hr, div.
- Do not use markdown.
- Keep titles short and teacher-friendly.
- Match the selected Canvas item type.
- When Oak curriculum context is provided, use it for vocabulary, misconceptions, and practice design.`
          },
          {
            role: "user",
            content: `Item type: ${itemType}
Audience / Support level: ${supportLevel}
Standard: ${standard}
Subject: ${subject}
Year / Grade: ${year}
Teacher request: ${prompt}

Oak context:
${oakResult.context}`
          }
        ]
      });

      const raw = completion.choices[0].message.content;
      const cleaned = raw
        .replace(/^```json\\s*/i, "")
        .replace(/^```\\s*/i, "")
        .replace(/\\s*```$/i, "");

      const parsed = JSON.parse(cleaned);
      const finalChunks = [...(parsed.chunks || []), ...(oakResult.extraChunks || [])];

      res.json({
        chunks: finalChunks,
        oakUsed: oakResult.used
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ chunks: [], oakUsed: false });
    }
  });

  app.post("/translate-content", async (req, res) => {
    try {
      const { html, language } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate the provided HTML into the requested language.
Preserve the HTML structure exactly.
Return ONLY raw HTML.`
          },
          {
            role: "user",
            content: `Target language: ${language}

HTML to translate:
${html}`
          }
        ]
      });

      const raw = completion.choices[0].message.content;
      const cleaned = raw
        .replace(/^```html\\s*/i, "")
        .replace(/^```\\s*/i, "")
        .replace(/\\s*```$/i, "");

      res.send(cleaned);
    } catch (err) {
      console.error(err);
      res.status(500).send("Translation failed");
    }
  });

  app.post("/return-deeplink", async (req, res) => {
    try {
      const html = req.body.html || "<p>No content generated</p>";
      const items = [{ type: "html", html }];

      const form = await lti.DeepLinking.createDeepLinkingForm(
        res.locals.token,
        items,
        { message: "AI Curriculum Builder content" }
      );

      res.send(form);
    } catch (err) {
      console.error(err);
      res.status(500).send("Deep linking failed");
    }
  });
});
