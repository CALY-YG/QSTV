import { supabase } from '../lib/supabase';
import type { BookmarkItem } from './bookmarks';

// Safe wrapper to prevent application from crashing if the bookmarks table doesn't exist yet
const safeDbCall = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    console.warn('Supabase bookmarks table operation failed (table may not be created yet). Gracefully falling back to local storage.', error);
    return fallback;
  }
};

export const pushBookmarkToCloud = async (userId: string, item: BookmarkItem): Promise<void> => {
  await safeDbCall(
    (async () => {
      const { error } = await supabase.from('bookmarks').upsert({
        user_id: userId,
        vod_id: item.vodId,
        vod_name: item.vodName,
        vod_pic: item.vodPic,
        type_name: item.typeName,
        source_key: item.sourceKey,
        bookmarked_at: item.bookmarkedAt,
      }, {
        onConflict: 'user_id, vod_id, source_key'
      });

      if (error) {
        console.error('Failed to push bookmark to cloud:', error);
      }
    })(),
    undefined
  );
};

export const removeBookmarkFromCloud = async (userId: string, vodId: number, sourceKey: string): Promise<void> => {
  await safeDbCall(
    (async () => {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .match({ user_id: userId, vod_id: vodId, source_key: sourceKey });

      if (error) {
        console.error('Failed to remove bookmark from cloud:', error);
      }
    })(),
    undefined
  );
};

export const clearCloudBookmarks = async (userId: string): Promise<void> => {
  await safeDbCall(
    (async () => {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .match({ user_id: userId });

      if (error) {
        console.error('Failed to clear cloud bookmarks:', error);
      }
    })(),
    undefined
  );
};

export const fetchCloudBookmarks = async (userId: string): Promise<BookmarkItem[]> => {
  return await safeDbCall(
    (async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('bookmarked_at', { ascending: false });

      if (error || !data) {
        console.error('Failed to fetch cloud bookmarks:', error);
        return [];
      }

      return data.map(row => ({
        vodId: row.vod_id,
        vodName: row.vod_name,
        vodPic: row.vod_pic,
        typeName: row.type_name,
        sourceKey: row.source_key,
        bookmarkedAt: row.bookmarked_at,
      }));
    })(),
    []
  );
};

export const syncCloudBookmarks = async (userId: string, localList: BookmarkItem[]): Promise<void> => {
  await safeDbCall(
    (async () => {
      const rows = localList.map(item => ({
        user_id: userId,
        vod_id: item.vodId,
        vod_name: item.vodName,
        vod_pic: item.vodPic,
        type_name: item.typeName,
        source_key: item.sourceKey,
        bookmarked_at: item.bookmarkedAt,
      }));

      if (rows.length === 0) return;

      const { error } = await supabase.from('bookmarks').upsert(rows, {
        onConflict: 'user_id, vod_id, source_key'
      });

      if (error) {
        console.error('Failed to sync cloud bookmarks:', error);
      }
    })(),
    undefined
  );
};
