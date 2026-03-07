const express = require("express");
const path = require("path");
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
    url: process.env.DATABASE_URL || "mongodb://127.0.0.1/ltijs"
  },
  {
    appRoute: "/",
    loginRoute: "/lti/login",
    devMode: true
  }
);

// -----------------------------
// Deep linking launch
// -----------------------------
lti.onDeepLinking(async (token, req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Curriculum Builder</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 24px;
          background: #f7f7f7;
        }
        .card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        label {
          display: block;
          font-weight: bold;
          margin-top: 14px;
          margin-bottom: 6px;
        }
        input, textarea {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ccc;
          font-family: Arial, sans-serif;
          font-size: 14px;
          box-sizing: border-box;
        }
        textarea {
          min-height: 140px;
        }
        button {
          margin-top: 16px;
          margin-right: 10px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 18px;
          font-weight: bold;
          cursor: pointer;
        }
        .preview {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fafafa;
          min-height: 80px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Curriculum Builder</h1>

        <label for="standard">Standard</label>
        <input id="standard" placeholder="ex: 6.RP.A.1" />

        <label for="prompt">Teacher Prompt</label>
        <textarea id="prompt" placeholder="Create a reteach activity for struggling students"></textarea>

        <button onclick="generate()">Generate</button>
        <button onclick="insertIntoCanvas()">Insert Into Canvas</button>

        <div id="preview" class="preview"></div>
      </div>

      <script>
        async function generate() {
          const standard = document.getElementById("standard").value;
          const prompt = document.getElementById("prompt").value;

          const response = await fetch("/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ standard, prompt })
          });

          const html = await response.text();
          document.getElementById("preview").innerHTML = html;
        }

        async function insertIntoCanvas() {
          const html = document.getElementById("preview").innerHTML;

          const response = await fetch("/return-deeplink", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ html })
          });

          const page = await response.text();
          document.open();
          document.write(page);
          document.close();
        }
      </script>
    </body>
    </html>
  `);
});

// -----------------------------
// Generate preview with OpenAI
// -----------------------------
app.post("/generate", async (req, res) => {
  try {
    const { standard, prompt } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You help teachers create standards-aligned classroom content for Canvas LMS. Return ONLY valid HTML. Do not use markdown. Do not wrap the response in code fences."
        },
        {
          role: "user",
          content: `Standard: ${standard}
Teacher request: ${prompt}`
        }
      ]
    });

    const html = completion.choices[0].message.content;
    res.send(html);
  } catch (error) {
    console.error(error);
    res.send("<p>Error generating content.</p>");
  }
});

// -----------------------------
// Return deep link content
// -----------------------------
app.post("/return-deeplink", async (req, res) => {
  try {
    const html = req.body.html || "<p>No content generated.</p>";

    const items = [
      {
        type: "html",
        html
      }
    ];

    const form = await lti.DeepLinking.createDeepLinkingForm(res.locals.token, items, {
      message: "Content added from Curriculum Builder"
    });

    res.send(form);
  } catch (error) {
    console.error(error);
    res.send("Deep linking failed.");
  }
});

// -----------------------------
// Attach ltijs to Express
// -----------------------------
lti.deploy({ port: PORT }).then(() => {
  const app = lti.app;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    res.send("Canvas Deep Link Builder is running.");
  });

  app.post("/generate", async (req, res) => {
    try {
      const { standard, prompt } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You help teachers create standards-aligned classroom content for Canvas LMS. Return ONLY valid HTML. Do not use markdown. Do not wrap the response in code fences."
          },
          {
            role: "user",
            content: `Standard: ${standard}
Teacher request: ${prompt}`
          }
        ]
      });

      const html = completion.choices[0].message.content;
      res.send(html);
    } catch (error) {
      console.error(error);
      res.send("<p>Error generating content.</p>");
    }
  });

  app.post("/return-deeplink", async (req, res) => {
    try {
      const html = req.body.html || "<p>No content generated.</p>";

      const items = [
        {
          type: "html",
          html
        }
      ];

      const form = await lti.DeepLinking.createDeepLinkingForm(res.locals.token, items, {
        message: "Content added from Curriculum Builder"
      });

      res.send(form);
    } catch (error) {
      console.error(error);
      res.send("Deep linking failed.");
    }
  });
});
