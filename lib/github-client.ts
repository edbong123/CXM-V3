export interface ContextFile {
  name: string
  path: string
  sha: string
  content?: string
}

const BASE = "https://api.github.com"

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

export async function fetchContextFiles(token: string, repo: string): Promise<ContextFile[]> {
  const res = await fetch(`${BASE}/repos/${repo}/contents/context`, {
    headers: headers(token),
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to fetch context folder: ${res.statusText}`)
  const data: Array<{ name: string; path: string; sha: string; type: string }> = await res.json()
  return data
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map(({ name, path, sha }) => ({ name, path, sha }))
}

export async function fetchFileContent(token: string, repo: string, path: string): Promise<string> {
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
    headers: headers(token),
  })
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`)
  const data: { content: string; encoding: string } = await res.json()
  if (data.encoding === "base64") {
    return atob(data.content.replace(/\n/g, ""))
  }
  return data.content
}

export async function commitFile(
  token: string,
  repo: string,
  path: string,
  sha: string,
  content: string,
  message: string
): Promise<void> {
  const encoded = btoa(unescape(encodeURIComponent(content)))
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded, sha }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Commit failed: ${res.statusText}`)
  }
}

export async function createFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<{ sha: string }> {
  const encoded = btoa(unescape(encodeURIComponent(content)))
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: encoded }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Create failed: ${res.statusText}`)
  }
  const data = await res.json()
  return { sha: data.content.sha }
}
