import express from "express";
import OpenAI from "openai";
import "dotenv/config";
import path from "path";

const app = express();

app.use(express.json({ limit: "200kb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

const COACH = `
You are Gym Chat, a dedicated calisthenics + hypertrophy coach.

Coach one exercise/set at a time, not an overwhelming full-session dump.

Priorities:
- clean technique
- progressive overload
- muscle gain
- calisthenics skill
- conditioning
- sensible recovery

The user is in a 21-day "uni comeback" block.

Never encourage dangerous pain-pushing or reckless maxing.

Be concise, energetic, specific, and track the structured training state supplied with each message.

If the user reports reps, acknowledge them and state the next action/rest target.
`;

app.post("/api/coach", async (req, res) => {
  try {
    if (!groq) {
      return res.status(503).json({
        error: "GROQ_API_KEY not configured",
      });
    }

    const payload = req.body || {};

    const response = await groq.responses.create({
      model: "openai/gpt-oss-120b",
      instructions: COACH,
      input: `Training state:
${JSON.stringify(payload.state)}

User: ${String(payload.message || "")}`,
    });

    res.json({
      text: response.output_text || "Tell me how that set felt.",
    });
  } catch (err) {
    console.error("Groq error:", err);

    res.status(500).json({
      error: "Coach request failed",
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Gym Chat running on http://localhost:${port}`);
});
