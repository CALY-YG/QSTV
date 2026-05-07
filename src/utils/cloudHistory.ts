import { supabase } from '../lib/supabase';
import type { HistoryItem } from './history';

export const pushHistoryToCloud = async (userId: string, item: HistoryItem): Promise<void> => {
  const { error } = await supabase.from('watch_history').upsert({
    user_id: userId,
    vod_id: item.vodId,
    vod_name: item.vodName,
    vod_pic: item.vodPic,
    type_name: item.typeName,
    source_key: item.sourceKey,
    episode_index: item.episodeIndex,
    episode_name: item.episodeName,
    playback_time: item.playbackTime,
    watched_at: item.watchedAt,
  }, {
    onConflict: 'user_id, vod_id, source_key'
  });

  if (error) {
    console.error('Failed to push history to cloud:', error);
  }
};

export const removeHistoryFromCloud = async (userId: string, vodId: number, sourceKey: string): Promise<void> => {
  const { error } = await supabase
    .from('watch_history')
    .delete()
    .match({ user_id: userId, vod_id: vodId, source_key: sourceKey });

  if (error) {
    console.error('Failed to remove history from cloud:', error);
  }
};

export const clearCloudHistory = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('watch_history')
    .delete()
    .match({ user_id: userId });

  if (error) {
    console.error('Failed to clear cloud history:', error);
  }
};

export const fetchCloudHistory = async (userId: string): Promise<HistoryItem[]> => {
  const { data, error } = await supabase
    .from('watch_history')
    .select('*')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false });

  if (error || !data) {
    console.error('Failed to fetch cloud history:', error);
    return [];
  }

  return data.map(row => ({
    vodId: row.vod_id,
    vodName: row.vod_name,
    vodPic: row.vod_pic,
    typeName: row.type_name,
    sourceKey: row.source_key,
    episodeIndex: row.episode_index,
    episodeName: row.episode_name,
    playbackTime: row.playback_time,
    watchedAt: row.watched_at,
  }));
};

export const syncCloudHistory = async (userId: string, localList: HistoryItem[]): Promise<void> => {
  // For a full sync override, we can either delete and insert, or just use upsert
  const rows = localList.map(item => ({
    user_id: userId,
    vod_id: item.vodId,
    vod_name: item.vodName,
    vod_pic: item.vodPic,
    type_name: item.typeName,
    source_key: item.sourceKey,
    episode_index: item.episodeIndex,
    episode_name: item.episodeName,
    playback_time: item.playbackTime,
    watched_at: item.watchedAt,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('watch_history').upsert(rows, {
    onConflict: 'user_id, vod_id, source_key'
  });

  if (error) {
    console.error('Failed to sync cloud history:', error);
  }
};
