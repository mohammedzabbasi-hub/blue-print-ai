const SAFE_ASSISTANT_FALLBACK =
  "The live assistant is temporarily unavailable. I can still use the workspace evidence already loaded in BluePrintAI to give conservative, advisory guidance.";

export function getLlamaConfig(env = process.env) {
  const provider = String(env.LLM_PROVIDER || "").trim().toLowerCase();
  const apiKey = firstPresent(env.LLAMA_API_KEY, env.LLAMA_API_TOKEN, env.LLM_API_KEY);
  const baseUrl = normalizeBaseUrl(firstPresent(
    env.LLAMA_API_BASE_URL,
    env.LLAMA_API_URL,
    env.LLAMA_BASE_URL,
  ));
  const model = String(env.LLAMA_MODEL || "llama-3.1-8b-instruct").trim();

  return {
    available: provider === "llama" && Boolean(apiKey && baseUrl && model),
    baseUrl,
    model,
    provider,
    missing: {
      apiKey: !apiKey,
      baseUrl: !baseUrl,
      model: !model,
      provider: provider !== "llama",
    },
  };
}

export function getGeminiConfig(env = process.env) {
  const provider = String(env.LLM_PROVIDER || "").trim().toLowerCase();
  const apiKey = firstPresent(env.GEMINI_API_KEY, env.GOOGLE_AI_API_KEY);
  const model = String(env.GEMINI_MODEL || env.GOOGLE_AI_MODEL || "gemini-2.5-flash").trim();
  const baseUrl = normalizeBaseUrl(
    firstPresent(
      env.GEMINI_API_BASE_URL,
      env.GOOGLE_AI_API_BASE_URL,
      "https://generativelanguage.googleapis.com/v1beta",
    ),
  );
  const selected = !provider || provider === "gemini" || provider === "google" || provider === "google_ai";

  return {
    available: selected && Boolean(apiKey && baseUrl && model),
    baseUrl,
    model,
    provider: "gemini",
    selected,
    missing: {
      apiKey: !apiKey,
      baseUrl: !baseUrl,
      model: !model,
      provider: !selected,
    },
  };
}

export async function completeAssistantChat({ messages, signal }, { env = process.env, fetchImpl = fetch } = {}) {
  const geminiConfig = getGeminiConfig(env);
  if (geminiConfig.available) {
    return completeGeminiChat({ messages, signal }, { config: geminiConfig, env, fetchImpl });
  }
  const config = getLlamaConfig(env);
  if (!config.available) {
    return {
      ok: false,
      fallback: true,
      message: SAFE_ASSISTANT_FALLBACK,
      provider: "fallback",
      reason: "not_configured",
    };
  }

  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        max_tokens: 700,
        messages,
        model: config.model,
        temperature: 0.3,
      }),
      headers: {
        Authorization: `Bearer ${firstPresent(env.LLAMA_API_KEY, env.LLAMA_API_TOKEN, env.LLM_API_KEY)}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      console.error("Assistant Llama provider request failed", {
        provider: "llama",
        status: response.status,
      });
      return providerFailure();
    }

    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    if (!content) {
      console.error("Assistant Llama provider returned an empty response", {
        provider: "llama",
        status: response.status,
      });
      return providerFailure();
    }

    return {
      content,
      ok: true,
      provider: "llama",
    };
  } catch (error) {
    console.error("Assistant Llama provider unavailable", {
      message: error?.name === "AbortError" ? "request_aborted" : error?.message,
      provider: "llama",
    });
    return providerFailure();
  }
}

async function completeGeminiChat({ messages, signal }, { config, env, fetchImpl }) {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }],
    }));
  const apiKey = firstPresent(env.GEMINI_API_KEY, env.GOOGLE_AI_API_KEY);
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetchImpl(url, {
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 700,
          temperature: 0.2,
        },
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal,
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      console.error("Assistant Gemini provider request failed", {
        provider: "gemini",
        status: response.status,
      });
      return providerFailure();
    }
    const content = (payload?.candidates?.[0]?.content?.parts || [])
      .map((part) => String(part?.text || ""))
      .join("\n")
      .trim();
    if (!content) {
      console.error("Assistant Gemini provider returned an empty response", {
        provider: "gemini",
        status: response.status,
      });
      return providerFailure();
    }
    return { content, ok: true, provider: "gemini" };
  } catch (error) {
    console.error("Assistant Gemini provider unavailable", {
      message: error?.name === "AbortError" ? "request_aborted" : error?.message,
      provider: "gemini",
    });
    return providerFailure();
  }
}

function providerFailure() {
  return {
    ok: false,
    fallback: true,
    message: SAFE_ASSISTANT_FALLBACK,
    provider: "fallback",
    reason: "provider_error",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function firstPresent(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}
