export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
};

/** A qualifying video plus where in the folder tree it was found. */
export type FoundVideo = DriveFile & {
  /** Folder names from the creator's root down to the file's parent. */
  folderPath: string[];
};

export type FolderScan = {
  videos: FoundVideo[];
  foldersVisited: number;
  /** True if a cap stopped the walk — surfaced rather than silently dropped. */
  truncated: boolean;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Creators nest deeply (AUGUST > Week 4 > …); this is generous but bounded. */
const MAX_DEPTH = 6;
/** Backstop against a pathological tree stalling the whole sync. */
const MAX_FOLDERS_PER_CREATOR = 200;

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
 * One page-complete listing of a folder's subfolders plus any videos created
 * after `createdAfter`. Both in a single query so a deep tree costs one call
 * per folder rather than two.
 */
async function listFolderContents(
  accessToken: string,
  folderId: string,
  createdAfter: Date,
): Promise<{ folders: DriveFile[]; videos: DriveFile[] }> {
  const folders: DriveFile[] = [];
  const videos: DriveFile[] = [];
  let pageToken: string | undefined;

  const q =
    `'${folderId}' in parents and trashed = false and (` +
    `mimeType = '${FOLDER_MIME}' or ` +
    `(mimeType contains 'video/' and createdTime > '${createdAfter.toISOString()}')` +
    `)`;

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

    for (const f of (data.files ?? []) as DriveFile[]) {
      if (f.mimeType === FOLDER_MIME) folders.push(f);
      else videos.push(f);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { folders, videos };
}

/**
 * Walks a creator's folder tree and returns every video created in the window.
 *
 * Recursion is essential, not a nicety: most creators organise into subfolders
 * ("AUGUST > Week 4", "Gym B Roll"), and a direct-children-only scan reported
 * zero deliveries for them no matter what they uploaded.
 *
 * Read-only throughout: only ever calls files.list.
 */
export async function scanFolderForVideos(
  accessToken: string,
  rootFolderId: string,
  createdAfter: Date,
): Promise<FolderScan> {
  const videos: FoundVideo[] = [];
  let foldersVisited = 0;
  let truncated = false;

  const seen = new Set<string>([rootFolderId]);
  let frontier: { id: string; path: string[] }[] = [{ id: rootFolderId, path: [] }];

  for (let depth = 0; depth <= MAX_DEPTH && frontier.length > 0; depth++) {
    const next: { id: string; path: string[] }[] = [];

    for (const node of frontier) {
      if (foldersVisited >= MAX_FOLDERS_PER_CREATOR) {
        truncated = true;
        break;
      }
      foldersVisited++;

      const { folders, videos: found } = await listFolderContents(
        accessToken,
        node.id,
        createdAfter,
      );

      for (const v of found) videos.push({ ...v, folderPath: node.path });

      if (depth < MAX_DEPTH) {
        for (const f of folders) {
          // Drive shortcuts can make a tree re-enter itself.
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          next.push({ id: f.id, path: [...node.path, f.name] });
        }
      } else if (folders.length > 0) {
        truncated = true;
      }
    }

    if (foldersVisited >= MAX_FOLDERS_PER_CREATOR) {
      truncated = true;
      break;
    }
    frontier = next;
  }

  return { videos, foldersVisited, truncated };
}
