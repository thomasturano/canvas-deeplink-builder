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
          max-width: 980px;
          margin: 0 auto;
        }

        .card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .header {
          padding: 26px 28px 18px 28px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        }

        .eyebrow {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          background: #e0e7ff;
          color: #3730a3;
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
        }

        .content {
          padding: 24px 28px 28px 28px;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #0f172a;
        }

        .field input,
        .field textarea {
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
        .field textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }

        .field textarea {
          min-height: 140px;
          resize: vertical;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
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
          background: #f8fafc;
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
          padding: 16px;
        }

        .chunk-body h1,
        .chunk-body h2,
        .chunk-body h3,
        .chunk-body h4 {
          margin-top: 0;
        }

        .chunk-body ul,
        .chunk-body ol {
          padding-left: 22px;
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

        @keyframes pulse {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
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
              Generate chunked standards-aligned content, choose the sections you want, then insert only those into Canvas.
            </p>
          </div>

          <div class="content">
            <div class="field">
              <label for="standard">Standard</label>
              <input id="standard" placeholder="Ex: 6.RP.A.1" />
            </div>

            <div class="field">
              <label for="prompt">Teacher Prompt</label>
              <textarea id="prompt" placeholder="Ex: Create a student-facing content page with an overview, vocabulary, worked examples, and a quick check for understanding."></textarea>
            </div>

            <div class="button-row">
              <button id="generateBtn" class="primary" onclick="generate()">Generate</button>
              <button id="insertBtn" class="secondary" onclick="insertIntoCanvas()">Insert Checked Into Canvas</button>
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
          const standard = document.getElementById("standard").value.trim();
          const prompt = document.getElementById("prompt").value.trim();

          if (!standard || !prompt) {
            setStatus("Please enter both a standard and a teacher prompt.", true);
            return;
          }

          try {
            setStatus("Generating chunked content...");
            setLoading(generateBtn, true, "Generate");

            const res = await fetch("/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ standard, prompt, ltik })
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

          const html = selectedChunks.map(chunk => chunk.html).join("\\n<hr />\\n");

          try {
            setStatus("Sending selected content back to Canvas...");
            setLoading(insertBtn, true, "Insert Checked Into Canvas");

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

  // REGISTER CANVAS PLATFORM
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
  // Generate content with AI
  // -----------------------------
  app.post("/generate", async (req, res) => {
    try {
      const { standard, prompt } = req.body;

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
    {
      "title": "Short chunk title",
      "html": "<section>...</section>"
    }
  ]
}

Rules:
- Return exactly 3 chunks.
- Each chunk should be useful on its own.
- Each chunk html must be valid raw HTML.
- Do not use markdown.
- Do not wrap anything in triple backticks.
- Good chunk examples: Overview, Key Vocabulary, Worked Example, Practice, Exit Ticket, Directions, Teacher Note.
- Keep titles short and teacher-friendly.`
          },
          {
            role: "user",
            content: `Standard: ${standard}\nTeacher request: ${prompt}`
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
