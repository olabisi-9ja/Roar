// Pure configuration helpers. Kept out of index.ts so tests can cover URL/resource handling without
// loading the Anthropic SDKs or reading the environment.

export function normalizeBaseUrl(raw: string | undefined): { url: string | undefined; warning: string | null } {
  if (!raw) return { url: undefined, warning: null };
  let url = raw.replace(/\/+$/, "");
  // Both Anthropic SDKs append /v1/messages. A base URL ending in /v1 therefore produces /v1/v1/messages.
  if (/\/v1$/i.test(url)) {
    url = url.slice(0, -3).replace(/\/+$/, "");
    return { url: url || undefined, warning: "Ignored a trailing /v1 on the AI base URL; the SDK adds /v1 itself." };
  }
  try {
    new URL(url);
  } catch {
    return { url: undefined, warning: "The AI base URL is not a valid URL." };
  }
  return { url, warning: null };
}

export function normalizeFoundryResource(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Accept either the resource name (preferred) or a copied Foundry endpoint/host.
  const host = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const name = host.includes(".") ? host.split(".")[0] : host;
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(name ?? "") ? name : undefined;
}

/** Foundry's OpenAI-compatible route for an AIServices resource. */
export function foundryOpenAiBaseUrl(resource: string): string {
  return `https://${resource}.services.ai.azure.com/openai/v1`;
}

/** Accept a bare Foundry host, /openai, or the full /openai/v1 base URL. */
export function normalizeOpenAiBaseUrl(raw: string | undefined): { url: string | undefined; warning: string | null } {
  if (!raw) return { url: undefined, warning: null };
  let url = raw.replace(/\/+$/, "");
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") {
      return { url: `${parsed.origin}/openai/v1`, warning: "Added /openai/v1 to the Azure OpenAI base URL." };
    }
  } catch {
    return { url: undefined, warning: "The Azure OpenAI base URL is not a valid URL." };
  }
  if (/\/chat\/completions$/i.test(url)) {
    return { url: url.replace(/\/chat\/completions$/i, ""), warning: "Removed /chat/completions from the Azure OpenAI base URL." };
  }
  if (/\/openai$/i.test(url)) {
    return { url: `${url}/v1`, warning: "Added /v1 to the Azure OpenAI base URL." };
  }
  return { url, warning: null };
}
