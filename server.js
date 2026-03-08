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
          padding: 28px;
        }

        .shell {
          max-width: 920px;
          margin: 0 auto;
        }

        .card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(8px);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .header {
          padding: 28px 28px 18px 28px;
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
          letter-spacing: 0.02em;
          margin-bottom: 12px;
        }

        h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
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
          display: grid;
          gap: 20px;
        }

        .field-grid {
          display: grid;
          gap: 18px;
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
          background: #ffffff;
          transition: all 0.18s ease;
          outline: none;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }

        .field textarea {
          min-height: 150px;
          resize: vertical;
        }

        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
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
        }

        .status.error {
          color: #b91c1c;
        }

        .preview-wrap {
          display: grid;
          gap: 10px;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .preview-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .preview-note {
          font-size: 12px;
          color: #64748b;
        }

        .preview {
          border: 1px solid #dbeafe;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border-radius: 16px;
          padding: 20px;
          min-height: 120px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          overflow-wrap: anywhere;
        }

        .preview h1,
        .preview h2,
        .preview h3 {
          margin-top: 0;
        }

        .preview ul,
        .preview ol {
          padding-left: 22px;
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
              Generate standards-aligned content, review it, then insert it directly into the Canvas editor.
            </p>
          </div>

          <div class="content">
            <div class="field-grid">
              <div class="field">
                <label for="standard">Standard</label>
                <input id="standard" placeholder="Ex: 6.RP.A.1" />
              </div>

              <div class="field">
                <label for="prompt">Teacher Prompt</label>
                <textarea id="prompt" placeholder="Ex: Create a student-facing content page with an overview, vocabulary, examples, and a short check for understanding."></textarea>
              </div>
            </div>

            <div class="button-row">
              <button id="generateBtn" class="primary" onclick="generate()">Generate</button>
              <button id="insertBtn" class="secondary" onclick="insertIntoCanvas()">Insert Into Canvas</button>
              <button class="ghost" onclick="clearPreview()">Clear</button>
            </div>

            <div id="status" class="status"></div>

            <div class="preview-wrap">
              <div class="preview-header">
                <div class="preview-title">Preview</div>
                <div class="preview-note">This content will be inserted into the Canvas editor.</div>
              </div>
              <div id="preview" class="preview">
                <span style="color:#64748b;">Nothing generated yet.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script>
        const ltik = new URLSearchParams(window.location.search).get("ltik");
        const generateBtn = document.getElementById("generateBtn");
        const insertBtn = document.getElementById("insertBtn");
        const statusEl = document.getElementById("status");
        const previewEl = document.getElementById("preview");

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
          previewEl.innerHTML = '<span style="color:#64748b;">Nothing generated yet.</span>';
          setStatus("");
        }

        async function generate() {
          const standard = document.getElementById("standard").value.trim();
          const prompt = document.getElementById("prompt").value.trim();

          if (!standard || !prompt) {
            setStatus("Please enter both a standard and a teacher prompt.", true);
            return;
          }

          try {
            setStatus("Generating content...");
            setLoading(generateBtn, true, "Generate");

            const res = await fetch("/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ standard, prompt, ltik })
            });

            const html = await res.text();

            if (!res.ok) {
              previewEl.innerHTML = '<span style="color:#b91c1c;">Generation failed.</span>';
              setStatus("Generate failed. Check your server logs for details.", true);
              return;
            }

            previewEl.innerHTML = html;
            setStatus("Content generated successfully.");
          } catch (err) {
            console.error(err);
            previewEl.innerHTML = '<span style="color:#b91c1c;">Generation failed.</span>';
            setStatus("Generate failed. Please try again.", true);
          } finally {
            setLoading(generateBtn, false, "Generate");
          }
        }

        async function insertIntoCanvas() {
          const html = previewEl.innerHTML;

          if (!html || html.includes("Nothing generated yet")) {
            setStatus("Generate content before inserting.", true);
            return;
          }

          try {
            setStatus("Sending content back to Canvas...");
            setLoading(insertBtn, true, "Insert Into Canvas");

            const res = await fetch("/return-deeplink", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html, ltik })
            });

            const page = await res.text();

            if (!res.ok) {
              setStatus("Deep linking failed. Check your server logs.", true);
              return;
            }

            document.open();
            document.write(page);
            document.close();
          } catch (err) {
            console.error(err);
            setStatus("Insert failed. Please try again.", true);
          } finally {
            setLoading(insertBtn, false, "Insert Into Canvas");
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

      const { standard, prompt } = req.body

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role:"system",
            content:"You create standards-aligned content for Canvas LMS. Return ONLY raw HTML. Do not use markdown. Do not wrap the response in triple backticks. Do not say html before the content. Start immediately with the first HTML tag."
          },
          {
            role:"user",
            content:`Standard: ${standard}\nTeacher request: ${prompt}`
          }
        ]
      })

      const html = completion.choices[0].message.content

      res.send(html)

    } catch(err) {

      console.error(err)
      res.send("<p>Error generating content</p>")

    }

  });

  // -----------------------------
  // Return deep link to Canvas
  // -----------------------------
  app.post("/return-deeplink", async (req,res)=>{

    try{

      const html = req.body.html || "<p>No content generated</p>"

      const items = [
        {
          type:"html",
          html
        }
      ]

      const form = await lti.DeepLinking.createDeepLinkingForm(
        res.locals.token,
        items,
        { message:"AI Curriculum Builder content" }
      )

      res.send(form)

    } catch(err){

      console.error(err)
      res.send("Deep linking failed")

    }

  });

});
