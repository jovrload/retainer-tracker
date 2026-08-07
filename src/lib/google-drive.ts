export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
};

/** Exchanges the long-lived refresh token for a short-lived access token. */
export async function getDriveAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to refresh Google access token: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

/**
 * Lists video files created after `createdAfter` in a single Drive folder.
 * Read-only: only ever calls files.list, never writes to Drive.
 * Paginates fully so folders with >1000 files are still counted correctly.
 */
export async function listVideosInFolder(
  accessToken: string,
  folderId: string,
  createdAfter: Date,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  const q = [
    `'${folderId}' in parents`,
    `mimeType contains 'video/'`,
    `trashed = false`,
    `createdTime > '${createdAfter.toISOString()}'`,
  ].join(" and ");

  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Drive API error for folder ${folderId}: ${JSON.stringify(data)}`);
    }

    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}
