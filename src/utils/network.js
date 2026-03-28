import logger from "./logger.js";

const DEFAULT_BODY_SNIPPET_LENGTH = 300;

function buildError(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}

export function withTimeout(taskFactory, timeoutMs, timeoutMessage, context = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.resolve().then(taskFactory);
  }

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(
        buildError(timeoutMessage || "Operation timed out", {
          ...context,
          timeoutMs,
          reason: "timeout",
        }),
      );
    }, timeoutMs);

    Promise.resolve()
      .then(taskFactory)
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export function safeParseJsonText(text, options = {}) {
  const {
    context = "response body",
    bodySnippetLength = DEFAULT_BODY_SNIPPET_LENGTH,
  } = options;

  const normalizedText = typeof text === "string" ? text : "";
  const trimmed = normalizedText.trim();

  if (!trimmed) {
    return {
      ok: false,
      data: null,
      error: buildError(`Empty JSON payload for ${context}`, {
        reason: "empty-body",
      }),
      rawBodySnippet: "",
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(trimmed),
      error: null,
      rawBodySnippet: trimmed.slice(0, bodySnippetLength),
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: buildError(`Invalid JSON payload for ${context}: ${error.message}`, {
        reason: "invalid-json",
      }),
      rawBodySnippet: trimmed.slice(0, bodySnippetLength),
    };
  }
}

export async function safeReadJsonResponse(response, options = {}) {
  const {
    requestUrl = "unknown-url",
    method = "GET",
    bodySnippetLength = DEFAULT_BODY_SNIPPET_LENGTH,
    allowEmptyBody = false,
    expectedJson = true,
    logPrefix = "[Network]",
  } = options;

  const contentType = response.headers?.get("content-type") || "";
  const status = response.status;
  const textBody = await response.text();
  const bodyLength = Buffer.byteLength(textBody || "", "utf8");
  const isJsonContentType = contentType.toLowerCase().includes("application/json");

  logger.debug(
    `${logPrefix} HTTP response`,
    {
      method,
      url: requestUrl,
      status,
      ok: response.ok,
      contentType: contentType || "unknown",
      bodyLength,
    },
  );

  if (status === 204 || status === 205 || bodyLength === 0) {
    if (allowEmptyBody) {
      return {
        ok: response.ok,
        status,
        contentType,
        bodyLength,
        data: null,
        error: null,
      };
    }

    return {
      ok: false,
      status,
      contentType,
      bodyLength,
      data: null,
      error: buildError("Expected JSON but received empty response body", {
        reason: "empty-body",
        status,
      }),
    };
  }

  if (expectedJson && !isJsonContentType) {
    return {
      ok: false,
      status,
      contentType,
      bodyLength,
      data: null,
      error: buildError(
        `Expected JSON but received '${contentType || "unknown"}'`,
        {
          reason: "non-json-content-type",
          status,
          bodySnippet: textBody.slice(0, bodySnippetLength),
        },
      ),
    };
  }

  const parsed = safeParseJsonText(textBody, {
    context: `${method} ${requestUrl}`,
    bodySnippetLength,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      status,
      contentType,
      bodyLength,
      data: null,
      error: buildError(parsed.error.message, {
        ...parsed.error.details,
        status,
        bodySnippet: parsed.rawBodySnippet,
      }),
    };
  }

  return {
    ok: response.ok,
    status,
    contentType,
    bodyLength,
    data: parsed.data,
    error: null,
  };
}
