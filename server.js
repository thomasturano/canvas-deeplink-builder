const express = require("express");
const lti = require("ltijs").Provider;
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PORT = process.env.PORT || 3000;

// -----------------------------
// LTI setup
// -----------------------------
lti.setup(
  process.env.LTI_KEY || "super-secret-lti-key-change-me",
  {
    url: process.env.DATABASE_URL
  },
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
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Curriculum Builder</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
          color: #0f172a;
          padding: 24px;
        }

        .shell {
          max-width: 1040px;
          margin: 0 auto;
        }

        .card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .header {
          padding: 28px 30px 18px 30px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        }

        .eyebrow {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        h1 {
          margin: 0 0 8px 0;
          font-size: 30px;
          line-height: 1.1;
        }

        .subtext {
          margin: 0;
          color: #475569;
          font-size: 14px;
          line-height: 1.5;
          max-width: 860px;
        }

        .content {
          padding: 24px 30px 30px 30px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #0f172a;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: all 0.18s ease;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .field textarea {
          min-height: 140px;
          resize: vertical;
        }

        .field-help {
          margin-top: 6px;
          font-size: 12px;
          color: #64748b;
        }

.inline-three {
  display: flex;
  gap: 16px;
}

.inline-three .field {
  flex: 1;
}

.inline-three .field:first-child {
  flex: 1.6;
}

.inline-three {
  flex-wrap: nowrap;
}

.inline-three .field:nth-child(2),
.inline-three .field:nth-child(3) {
  flex: .8;
}

        .inline-three .field {
          margin-bottom: 0;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .bottom-actions {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
        }

        .translation-panel {
          flex: 1 1 420px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .translation-toggle {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }

        .translation-options {
          display: none;
          max-width: 360px;
        }

        .translation-options.active {
          display: block;
        }

        button {
          appearance: none;
          border: none;
          border-radius: 14px;
          padding: 13px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }

        button:hover {
          transform: translateY(-1px);
        }

        button:disabled {
          opacity: 0.6;
          cursor: wait;
          transform: none;
        }

        .primary {
          background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
          color: white;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
        }

        .secondary {
          background: #0f172a;
          color: white;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.14);
        }

        .ghost {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #cbd5e1;
        }

        .status {
          min-height: 20px;
          font-size: 13px;
          color: #475569;
          margin-bottom: 16px;
        }

        .status.error {
          color: #b91c1c;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .preview-title {
          font-size: 15px;
          font-weight: 700;
        }

        .select-all-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
        }

        .chunks {
          display: grid;
          gap: 14px;
          margin-bottom: 18px;
        }

        .chunk-card {
          border: 1px solid #dbeafe;
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          overflow: hidden;
        }

        .chunk-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: #eff6ff;
        }

        .chunk-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .chunk-check {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
          white-space: nowrap;
        }

        .chunk-body {
          padding: 18px;
        }

        .chunk-body section {
          border-left: 4px solid #93c5fd;
          padding-left: 14px;
        }

        .chunk-body h1,
        .chunk-body h2,
        .chunk-body h3,
        .chunk-body h4,
        .chunk-body h5 {
          margin-top: 0;
          color: #0f172a;
        }

        .chunk-body p {
          line-height: 1.6;
        }

        .chunk-body ul,
        .chunk-body ol {
          padding-left: 22px;
          line-height: 1.6;
        }

        .chunk-body hr {
          border: none;
          border-top: 1px solid #dbeafe;
          margin: 16px 0;
        }

        .empty-preview {
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 20px;
          color: #64748b;
          background: #fff;
        }

        .loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.4;
          animation: pulse 1s infinite ease-in-out;
        }

        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }

        .helper-note {
          font-size: 13px;
          color: #64748b;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }

        @media (max-width: 720px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .inline-three {
            grid-template-columns: 1fr;
          }

          .bottom-actions {
            align-items: stretch;
          }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="card">
          <div class="header">
            <div class="eyebrow">Canvas + AI</div>
            <h1>AI Curriculum Builder</h1>
            <p class="subtext">
              Choose what you are creating, select the audience/support level, type a standard, and the tool will try to auto-fill subject and year/grade using AI.
            </p>
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
              <div class="preview-title">Preview</div>
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

                <div class="helper-note">Only checked sections will be inserted into Canvas. Translation preserves the HTML structure.</div>
              </div>

              <button id="insertBtn" class="secondary" onclick="insertIntoCanvas()">Insert Checked Into Canvas</button>
            </div>
          </div>
        </div>
      </div>

      <script>
        const ltik = new URLSearchParams(window.location.search).get("ltik");
        const generateBtn = document.getElementById("generateBtn");
        const insertBtn = document.getElementById("insertBtn");
        const statusEl = document.getElementById("status");
        const chunksEl = document.getElementById("chunks");
        const emptyPreviewEl = document.getElementById("emptyPreview");
        const selectAllEl = document.getElementById("selectAll");
        const translateCheckboxEl = document.getElementById("translateBeforeInsert");
        const translationOptionsEl = document.getElementById("translationOptions");

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

        function toggleTranslationOptions() {
          if (translateCheckboxEl.checked) {
            translationOptionsEl.classList.add("active");
          } else {
            translationOptionsEl.classList.remove("active");
          }
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

            if (data.subject) {
              document.getElementById("subject").value = data.subject;
            }

            if (data.grade) {
              document.getElementById("year").value = data.grade;
            }

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
                  <input type="checkbox" class="chunk-checkbox" data-index="\${index}" \${chunk.selected ? "checked" : ""} onchange="toggleChunk(\${index}, this.checked)" />
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
          generatedChunks = generatedChunks.map(chunk => ({
            ...chunk,
            selected: checked
          }));
          renderChunks();
        }

        function updateSelectAllState() {
          if (!generatedChunks.length) {
            selectAllEl.checked = false;
            return;
          }

          const allChecked = generatedChunks.every(chunk => chunk.selected);
          selectAllEl.checked = allChecked;
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

            const res = await fetch("/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemType, supportLevel, standard, subject, year, prompt, ltik })
            });

            const text = await res.text();

            if (!res.ok) {
              setStatus("Generate failed. Check your server logs.", true);
              emptyPreviewEl.style.display = "block";
              emptyPreviewEl.textContent = "Generation failed.";
              return;
            }

            const parsed = JSON.parse(text);

            generatedChunks = (parsed.chunks || []).map(chunk => ({
              title: chunk.title,
              html: chunk.html,
              selected: false
            }));

            renderChunks();
            setStatus("Content generated successfully.");
          } catch (err) {
            console.error(err);
            setStatus("Generate failed. Please try again.", true);
            emptyPreviewEl.style.display = "block";
            emptyPreviewEl.textContent = "Generation failed.";
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

              const translatedHtml = await translateRes.text();

              if (!translateRes.ok) {
                setStatus("Translation failed. Check your server logs.", true);
                return;
              }

              html = translatedHtml;
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
// Deploy LTI provider
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

  // -----------------------------
  // Detect subject + grade from standard using AI
  // -----------------------------
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
}

Rules:
- Infer the most likely subject and grade from the standard code.
- If the standard looks like a Common Core math code such as 6.RP.A.1, return Math and Grade 6.
- If the standard looks like an ELA code such as RL.6.2 or 6.RI.1, return ELA and Grade 6.
- If the standard looks like NGSS like 5-ESS2-1, return Science and Grade 5.
- If unsure, return "Other" and "Unknown".
- Do not include explanation.`
          },
          {
            role: "user",
            content: standard
          }
        ]
      });

      const parsed = JSON.parse(completion.choices[0].message.content);
      res.json(parsed);
    } catch (err) {
      console.error(err);
      res.status(500).json({});
    }
  });

  // -----------------------------
  // Generate content with AI
  // -----------------------------
  app.post("/generate", async (req, res) => {
    try {
      const { itemType, supportLevel, standard, subject, year, prompt } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You create standards-aligned content for Canvas LMS.

Your style should feel inspired by a polished blue-themed Canvas course template:
- clean overview-first structure
- clear section headings
- student-friendly language
- support/resources woven in naturally
- visually scannable chunks
- professional but warm tone

Return ONLY valid JSON in this exact shape:
{
  "chunks": [
    {
      "title": "Short chunk title",
      "html": "<section>...</section>"
    }
  ]
}

General rules:
- Return exactly 3 chunks.
- Each chunk should be useful on its own.
- Each chunk html must be valid raw HTML.
- Use semantic HTML only: section, h2, h3, p, ul, ol, li, strong, em, hr, div.
- Do not use markdown.
- Do not wrap anything in triple backticks.
- Keep titles short and teacher-friendly.
- Make the chunks match the selected Canvas item type.
- Make the content look polished and ready to insert into Canvas immediately.

Audience / support-level rules:
- Tier 1: Core Instruction for All Students = strong universal core instruction, grade-level access, clear explanations, broad accessibility
- Tier 2: Targeted Interventions for Small Groups = small-group supports, targeted practice, guided reteach, focused scaffolds
- Tier 3: Intensive Support for Individuals = highly scaffolded, explicit instruction, smaller steps, intensive supports, simplified task flow
- IEP Support: Translation = language-accessible wording and translation-friendly phrasing
- IEP Support: Scaffolded = accommodation-friendly wording, chunked tasks, check-ins, supports, guided progression

Chunking rules by item type:

If itemType is "Content Page":
1. Week / Lesson Overview
2. Key Concepts / Vocabulary
3. Practice / Check for Understanding

If itemType is "Assignment":
1. Assignment Overview
2. Student Directions
3. Submission Expectations / Success Criteria

If itemType is "Discussion":
1. Discussion Prompt
2. Posting Expectations
3. Reply / Follow-Up Guidance

If itemType is "Quiz Directions":
1. Instructions
2. Guidelines / Expectations
3. Reminders / Support

If itemType is "Quiz Question":
1. Question
2. Answer Choices or Expected Response
3. Teacher Note

Formatting guidance:
- Make each chunk visually nice but still Canvas-safe.
- Use a top-level <section>.
- Start each chunk with a clear <h2> or <h3>.
- Use bullets where they improve readability.
- For overview-style chunks, include a short intro paragraph.
- For support-heavy chunks, include a short list of reminders, supports, or scaffolds.
- Make the result better than a basic template: cleaner, clearer, more usable.`
          },
          {
            role: "user",
            content: `Item type: ${itemType}
Audience / Support level: ${supportLevel}
Standard: ${standard}
Subject: ${subject}
Year / Grade: ${year}
Teacher request: ${prompt}`
          }
        ]
      });

      const raw = completion.choices[0].message.content;

      const cleaned = raw
        .replace(/^```json\\s*/i, "")
        .replace(/^```\\s*/i, "")
        .replace(/\\s*```$/i, "");

      const parsed = JSON.parse(cleaned);

      res.json(parsed);
    } catch (err) {
      console.error(err);
      res.status(500).send(JSON.stringify({ chunks: [] }));
    }
  });

  // -----------------------------
  // Translate selected content while preserving HTML
  // -----------------------------
  app.post("/translate-content", async (req, res) => {
    try {
      const { html, language } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate the provided HTML content into the requested language.

Rules:
- Preserve the HTML structure exactly.
- Do not remove or add HTML tags unnecessarily.
- Translate only the visible text content.
- Do not use markdown.
- Do not wrap the response in triple backticks.
- Return ONLY raw HTML.`
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

  // -----------------------------
  // Return deep link to Canvas
  // -----------------------------
  app.post("/return-deeplink", async (req, res) => {
    try {
      const html = req.body.html || "<p>No content generated</p>";

      const items = [
        {
          type: "html",
          html
        }
      ];

      const form = await lti.DeepLinking.createDeepLinkingForm(
        res.locals.token,
        items,
        { message: "AI Curriculum Builder content" }
      );

      res.send(form);
    } catch (err) {
      console.error(err);
      res.send("Deep linking failed");
    }
  });
});
