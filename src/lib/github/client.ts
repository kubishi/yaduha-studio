const GITHUB_API = "https://api.github.com";

export async function githubFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "yaduha-studio",
      ...init?.headers,
    },
  });
}
