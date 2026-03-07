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
      <style>
        body {
          font-family: Arial;
          padding: 24px;
          background:#f7f7f7;
        }
        .card {
          background:white;
          border-radius:10px;
          padding:20px;
          max-width:800px;
          margin:auto;
        }
        input,textarea{
          width:100%;
          padding:10px;
          margin-top:6px;
          margin-bottom:12px;
          border-radius:6px;
          border:1px solid #ccc;
        }
        button{
          padding:10px 18px;
          border:none;
          border-radius:6px;
          background:#2563eb;
          color:white;
          font-weight:bold;
          margin-right:10px;
        }
        .preview{
          margin-top:20px;
          padding:10px;
          border:1px solid #ddd;
          background:#fafafa;
        }
      </style>
    </head>

    <body>
      <div class="card">
        <h2>AI Curriculum Builder</h2>

        <label>Standard</label>
        <input id="standard" placeholder="6.RP.A.1">

        <label>Teacher Prompt</label>
        <textarea id="prompt" placeholder="Create a reteach activity"></textarea>

        <button onclick="generate()">Generate</button>
        <button onclick="insert()">Insert Into Canvas</button>

        <div id="preview" class="preview"></div>
      </div>

      <script>

        async function generate(){
          const standard = document.getElementById("standard").value
          const prompt = document.getElementById("prompt").value

          const res = await fetch("/generate",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({standard,prompt})
          })

          const html = await res.text()
          document.getElementById("preview").innerHTML = html
        }

        async function insert(){

          const html = document.getElementById("preview").innerHTML

          const res = await fetch("/return-deeplink",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({html})
          })

          const page = await res.text()

          document.open()
          document.write(page)
          document.close()

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
            content:"Generate standards-aligned HTML for Canvas LMS. Return only valid HTML."
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
