/**
 * Minimal chat-completion client for Phase 7 Sentinel AI.
 *
 * Provider: Groq, called through its OpenAI-compatible REST endpoint
 * (https://api.groq.com/openai/v1/chat/completions). The request/
 * response JSON shape is identical to OpenAI's Chat Completions API,
 * so nothing else in services/sentinel-ai/* needed to change — only
 * the base URL, the API key env var, and the model env var differ
 * from the original OpenAI setup.
 *
 * This file's name and its exported function name
 * (callOpenAIChatCompletion) are kept unchanged intentionally, so that
 * explainPlaybook.ts's `import { callOpenAIChatCompletion } from
 * "./openaiClient"` required no changes at all. This file is the sole
 * integration point with the LLM provider.
 *
 * Uses Node's built-in global fetch — no new npm dependency, same
 * pattern as services/playbook-engine/razorpayClient.ts.
 */

const GROQ_API_BASE = "https://api.groq.com/openai/v1";

/**
 * Sends a single read-only chat completion request to Groq and returns
 * the generated text. Throws on any failure — the caller
 * (explainPlaybook.ts) is responsible for catching this so a failed
 * Groq call never breaks the playbook-generation pipeline.
 */
export async function callOpenAIChatCompletion(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You explain already-finalized payment recovery playbooks in plain, factual language for a merchant dashboard. You do not invent numbers, strategies, or recommendations — you only restate and explain the fixed fields you are given.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  const body = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(`Groq chat completion failed: ${response.status} ${JSON.stringify(body)}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Groq response contained no explanation text");
  }

  return content.trim();
}