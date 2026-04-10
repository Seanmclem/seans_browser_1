const SEARCH_URL = "https://www.google.com/search?q=";

export function normalizeURL(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return "about:blank";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("about:")
  ) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  return `${SEARCH_URL}${encodeURIComponent(trimmed)}`;
}

