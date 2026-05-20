import { pushBookmarkToCloud, removeBookmarkFromCloud, clearCloudBookmarks, fetchCloudBookmarks, syncCloudBookmarks } from './cloudBookmarks';

export interface BookmarkItem {
  vodId: number;
  vodName: string;
  vodPic?: string;
  typeName: string;
  sourceKey: string;
  bookmarkedAt: number; // timestamp
}

const STORAGE_KEY = 'qstv_bookmarks';
const MAX_BOOKMARKS = 200;

const getCurrentUserId = (): string | null => {
  try {
    const raw = localStorage.getItem('qstv_current_user');
    if (raw) return JSON.parse(raw).id;
  } catch {
    // ignore
  }
  return null;
};

export const getBookmarks = (): BookmarkItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookmarkItem[];
  } catch {
    return [];
  }
};

const setLocalBookmarks = (list: BookmarkItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const isBookmarked = (vodId: number, sourceKey: string): boolean => {
  const list = getBookmarks();
  return list.some(b => String(b.vodId) === String(vodId) && b.sourceKey === sourceKey);
};

export const addBookmark = (item: Omit<BookmarkItem, 'bookmarkedAt'>): void => {
  const list = getBookmarks();
  // Filter out any existing copy of this item
  const filtered = list.filter(
    b => !(String(b.vodId) === String(item.vodId) && b.sourceKey === item.sourceKey)
  );
  
  const newItem: BookmarkItem = {
    ...item,
    bookmarkedAt: Date.now()
  };
  
  // Unshift to add to the beginning (most recent bookmark first)
  filtered.unshift(newItem);
  if (filtered.length > MAX_BOOKMARKS) {
    filtered.length = MAX_BOOKMARKS;
  }
  
  setLocalBookmarks(filtered);

  // Sync to cloud if user logged in
  const userId = getCurrentUserId();
  if (userId) {
    pushBookmarkToCloud(userId, newItem).catch(console.error);
  }
};

export const removeBookmark = (vodId: number, sourceKey: string): void => {
  const list = getBookmarks();
  const filtered = list.filter(
    b => !(String(b.vodId) === String(vodId) && b.sourceKey === sourceKey)
  );
  setLocalBookmarks(filtered);

  const userId = getCurrentUserId();
  if (userId) {
    removeBookmarkFromCloud(userId, vodId, sourceKey).catch(console.error);
  }
};

export const clearAllBookmarks = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  
  const userId = getCurrentUserId();
  if (userId) {
    clearCloudBookmarks(userId).catch(console.error);
  }
};

export const forceSyncBookmarksWithCloud = async (): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const cloudList = await fetchCloudBookmarks(userId);
    const localList = getBookmarks();

    // Merge logic: Map by unique key (vodId + sourceKey)
    const map = new Map<string, BookmarkItem>();
    
    // Add local items
    localList.forEach(item => {
      map.set(`${item.vodId}-${item.sourceKey}`, item);
    });

    // Add or overwrite with cloud items if they are newer
    cloudList.forEach(item => {
      const key = `${item.vodId}-${item.sourceKey}`;
      const existing = map.get(key);
      if (!existing || item.bookmarkedAt > existing.bookmarkedAt) {
        map.set(key, item);
      }
    });

    let merged = Array.from(map.values()).sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
    if (merged.length > MAX_BOOKMARKS) {
      merged = merged.slice(0, MAX_BOOKMARKS);
    }

    setLocalBookmarks(merged);
    await syncCloudBookmarks(userId, merged);
  } catch (error) {
    console.error('Failed to sync bookmarks with cloud:', error);
  }
};
