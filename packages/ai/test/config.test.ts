import assert from "node:assert/strict";
import { test } from "node:test";
import { foundryOpenAiBaseUrl, normalizeBaseUrl, normalizeFoundryResource, normalizeOpenAiBaseUrl } from "../src/config.js";

test("normalizeBaseUrl strips a trailing /v1 and warns", () => {
  const withSlash = normalizeBaseUrl("https://api.example.com/v1/");
  assert.equal(withSlash.url, "https://api.example.com");
  assert.match(withSlash.warning ?? "", /trailing \/v1/);

  const withoutSlash = normalizeBaseUrl("https://api.example.com/v1");
  assert.equal(withoutSlash.url, "https://api.example.com");
  assert.match(withoutSlash.warning ?? "", /trailing \/v1/);
});

test("normalizeBaseUrl keeps a valid base URL untouched", () => {
  const result = normalizeBaseUrl("https://api.example.com/");
  assert.equal(result.url, "https://api.example.com");
  assert.equal(result.warning, null);
});

test("normalizeBaseUrl rejects invalid URLs and empty input", () => {
  const invalid = normalizeBaseUrl("not a url");
  assert.equal(invalid.url, undefined);
  assert.match(invalid.warning ?? "", /not a valid URL/);

  const empty = normalizeBaseUrl(undefined);
  assert.equal(empty.url, undefined);
  assert.equal(empty.warning, null);
});

test("normalizeFoundryResource accepts names and copied endpoints", () => {
  assert.equal(normalizeFoundryResource("roar-foundry"), "roar-foundry");
  assert.equal(normalizeFoundryResource("https://roar-foundry.cognitiveservices.azure.com/"), "roar-foundry");
  assert.equal(normalizeFoundryResource("roar-foundry.services.ai.azure.com"), "roar-foundry");
});

test("normalizeFoundryResource rejects malformed names", () => {
  assert.equal(normalizeFoundryResource("-bad-"), undefined);
  assert.equal(normalizeFoundryResource("ab"), undefined);
  assert.equal(normalizeFoundryResource(undefined), undefined);
});

test("foundryOpenAiBaseUrl builds the OpenAI-compatible Foundry route", () => {
  assert.equal(foundryOpenAiBaseUrl("roar-foundry"), "https://roar-foundry.services.ai.azure.com/openai/v1");
});

test("normalizeOpenAiBaseUrl accepts hosts and partial routes", () => {
  assert.equal(normalizeOpenAiBaseUrl("https://roar-foundry.services.ai.azure.com/").url, "https://roar-foundry.services.ai.azure.com/openai/v1");
  assert.equal(normalizeOpenAiBaseUrl("https://roar-foundry.services.ai.azure.com/openai").url, "https://roar-foundry.services.ai.azure.com/openai/v1");
  assert.equal(normalizeOpenAiBaseUrl("https://roar-foundry.services.ai.azure.com/openai/v1/").url, "https://roar-foundry.services.ai.azure.com/openai/v1");
  assert.equal(normalizeOpenAiBaseUrl("https://roar-foundry.services.ai.azure.com/openai/v1/chat/completions").url, "https://roar-foundry.services.ai.azure.com/openai/v1");
});

test("normalizeOpenAiBaseUrl rejects invalid input and handles empty input", () => {
  const invalid = normalizeOpenAiBaseUrl("not a url");
  assert.equal(invalid.url, undefined);
  assert.match(invalid.warning ?? "", /not a valid URL/);
  assert.equal(normalizeOpenAiBaseUrl(undefined).url, undefined);
});
