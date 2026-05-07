import { pushHistoryToCloud, removeHistoryFromCloud, clearCloudHistory, fetchCloudHistory, syncCloudHistory } from './cloudHistory';

export interface HistoryItem {
  vodId: number;
  vodName: string;
  vodPic?: string;
  typeName: string;
  sourceKey: string;
  episodeIndex: number;
  episodeName: string;
  playbackTime: number; // seconds into the video
  watchedAt: number; // timestamp
}

const STORAGE_KEY = 'qstv_history';
const MAX_HISTORY = 100;

const getCurrentUserId = (): string | null => {
  try {
    const raw = localStorage.getItem('qstv_current_user');
    if (raw) return JSON.parse(raw).id;
  } catch {
    // ignore
  }
  return null;
};

export const getHistory = (): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
};

const setLocalHistory = (list: HistoryItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const addHistory = (item: HistoryItem): void => {
  const list = getHistory();
  const filtered = list.filter(
    h => !(h.vodId === item.vodId && h.sourceKey === item.sourceKey)
  );
  const newItem = { ...item, watchedAt: Date.now() };
  filtered.unshift(newItem);
  if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY;
  setLocalHistory(filtered);

  // Sync to cloud
  const userId = getCurrentUserId();
  if (userId) {
    pushHistoryToCloud(userId, newItem).catch(console.error);
  }
};

export const getHistoryForVideo = (vodId: number, sourceKey: string): HistoryItem | null => {
  const list = getHistory();
  return list.find(h => h.vodId === vodId && h.sourceKey === sourceKey) || null;
};

export const removeHistory = (vodId: number, sourceKey: string): void => {
  const list = getHistory();
  const filtered = list.filter(
    h => !(h.vodId === vodId && h.sourceKey === sourceKey)
  );
  setLocalHistory(filtered);

  const userId = getCurrentUserId();
  if (userId) {
    removeHistoryFromCloud(userId, vodId, sourceKey).catch(console.error);
  }
};

export const clearAllHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  
  const userId = getCurrentUserId();
  if (userId) {
    clearCloudHistory(userId).catch(console.error);
  }
};

export const forceSyncWithCloud = async (): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) return;

  const cloudList = await fetchCloudHistory(userId);
  const localList = getHistory();

  // Merge logic: Map by unique key (vodId + sourceKey)
  const map = new Map<string, HistoryItem>();
  
  // Add local first
  localList.forEach(item => {
    map.set(`${item.vodId}-${item.sourceKey}`, item);
  });

  // Override or add cloud items if they are newer
  cloudList.forEach(item => {
    const key = `${item.vodId}-${item.sourceKey}`;
    const existing = map.get(key);
    if (!existing || item.watchedAt > existing.watchedAt) {
      map.set(key, item);
    }
  });

  // Sort by watchedAt desc
  let merged = Array.from(map.values()).sort((a, b) => b.watchedAt - a.watchedAt);
  if (merged.length > MAX_HISTORY) {
    merged = merged.slice(0, MAX_HISTORY);
  }

  // Save back to both
  setLocalHistory(merged);
  await syncCloudHistory(userId, merged);
};
