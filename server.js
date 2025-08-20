// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// If Node < 18, uncomment the shim and `npm i node-fetch`
// const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();

// Serve static files (index.html + quicksquad-chat-widget.js) from project root
app.use(express.static(path.join(__dirname)));

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

// Early validation helps avoid mysterious 500s
if (!OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is missing. Set it in .env");
}

app.post("/quicksquad-ai", async (req, res) => {
  console.log("> POST /quicksquad-ai", new Date().toISOString());
  try {
    const { messages = [] } = req.body || {};

    // Simple guardrail
    const guard = (messages[messages.length - 1]?.content || "").toLowerCase();
    if (guard.includes("password") && guard.includes("share")) {
      return res.status(400).json({
        reply:
          "For your security, never share passwords here. I can guide you to reset them securely instead.",
      });
    }

    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ reply: "Server misconfig: API key not set." });
    }

    // Call OpenAI
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are QuickSquad's website chat assistant for U.S. residents. Goals: (1) solve everyday tech and digital tasks, (2) be clear and brief (<= 8 steps), (3) add one-sentence safety note when appropriate, (4) if asked for personalized finance/legal/medical advice, provide general info + disclaimer and suggest professional help, (5) never request sensitive credentials, OTPs, SSNs, or full card numbers, (6) when an issue needs a human, offer: support@quicksquad.live. Tone: warm, direct, professional.",
          },
          ...messages,
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("[OpenAI error]", r.status, txt); // <- this tells you EXACTLY why
      return res.status(500).json({ reply: `Upstream error (${r.status}).` });
    }

    const data = await r.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I could not find an answer.";
    res.json({ reply });
  } catch (err) {
    console.error("[Server catch]", err);
    res.status(500).json({ reply: "Server issue — please try again shortly." });
  }
});

// Optional index route
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 8082;
app.listen(PORT, () =>
  console.log(`QuickSquad AI running on http://localhost:${PORT}`)
);
