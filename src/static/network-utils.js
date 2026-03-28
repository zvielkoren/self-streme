(function attachNetworkUtils(globalScope) {
  function buildError(message, details) {
    const error = new Error(message);
    error.details = details || {};
    return error;
  }

  async function readJsonResponseSafe(response, options) {
    const opts = options || {};
    const requestUrl = opts.requestUrl || "unknown-url";
    const allowEmptyBody = opts.allowEmptyBody === true;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const textBody = await response.text();
    const bodyLength = textBody.length;

    if (response.status === 204 || response.status === 205 || bodyLength === 0) {
      if (allowEmptyBody) {
        return { ok: response.ok, status: response.status, data: null, error: null };
      }

      return {
        ok: false,
        status: response.status,
        data: null,
        error: buildError(`Empty JSON response from ${requestUrl}`, {
          reason: "empty-body",
        }),
      };
    }

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: buildError(`Non-JSON response from ${requestUrl}`, {
          reason: "non-json-content-type",
          contentType: contentType || "unknown",
          bodySnippet: textBody.slice(0, 200),
        }),
      };
    }

    try {
      return {
        ok: response.ok,
        status: response.status,
        data: JSON.parse(textBody),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: buildError(`Invalid JSON response from ${requestUrl}: ${error.message}`, {
          reason: "invalid-json",
          bodySnippet: textBody.slice(0, 200),
        }),
      };
    }
  }

  async function fetchJsonSafe(url, fetchOptions, parseOptions) {
    const response = await fetch(url, fetchOptions);
    return readJsonResponseSafe(response, {
      requestUrl: url,
      ...(parseOptions || {}),
    });
  }

  globalScope.NetworkUtils = {
    readJsonResponseSafe,
    fetchJsonSafe,
  };
})(window);
