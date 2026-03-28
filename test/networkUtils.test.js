import test from "node:test";
import assert from "node:assert/strict";
import {
  safeParseJsonText,
  safeReadJsonResponse,
} from "../src/utils/network.js";

test("safeParseJsonText parses valid JSON", () => {
  const result = safeParseJsonText('{"ok":true}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { ok: true });
});

test("safeParseJsonText rejects empty and malformed JSON", () => {
  const empty = safeParseJsonText("   ");
  assert.equal(empty.ok, false);
  assert.match(empty.error.message, /empty json payload/i);

  const invalid = safeParseJsonText("{oops");
  assert.equal(invalid.ok, false);
  assert.match(invalid.error.message, /invalid json payload/i);
});

test("safeReadJsonResponse handles empty and non-json responses", async () => {
  const emptyResponse = new Response("", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const empty = await safeReadJsonResponse(emptyResponse, {
    requestUrl: "/empty",
  });
  assert.equal(empty.ok, false);
  assert.match(empty.error.message, /empty response body/i);

  const htmlResponse = new Response("<html>oops</html>", {
    status: 500,
    headers: { "content-type": "text/html" },
  });
  const nonJson = await safeReadJsonResponse(htmlResponse, {
    requestUrl: "/html",
  });
  assert.equal(nonJson.ok, false);
  assert.match(nonJson.error.message, /expected json/i);
});

test("safeReadJsonResponse handles valid JSON and explicit no-content", async () => {
  const validResponse = new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const valid = await safeReadJsonResponse(validResponse, {
    requestUrl: "/ok",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.data, { status: "ok" });

  const noContent = new Response(null, { status: 204 });
  const allowedNoContent = await safeReadJsonResponse(noContent, {
    requestUrl: "/nocontent",
    allowEmptyBody: true,
  });
  assert.equal(allowedNoContent.ok, true);
  assert.equal(allowedNoContent.data, null);
});
