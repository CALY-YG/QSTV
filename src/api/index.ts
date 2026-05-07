export interface Category {
  type_id: number;
  type_pid: number;
  type_name: string;
}

export interface Video {
  vod_id: number;
  vod_name: string;
  type_id: number;
  type_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_play_url?: string;
  vod_pic?: string;
  vod_content?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
}

export interface ApiResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: Video[];
  class?: Category[];
}

// ---- Source Configuration ----
export interface SourceConfig {
  key: string;
  name: string;
  apiBase: string;
}

export const SOURCES: SourceConfig[] = [
  {
    key: 'dytt',
    name: '电影天堂资源站',
    apiBase: '/api/proxy?s=dytt&',
  },
  {
    key: 'maoyan',
    name: '猫眼资源站',
    apiBase: '/api/proxy?s=maoyan&',
  },
  {
    key: 'maotai',
    name: '茅台资源站',
    apiBase: '/api/proxy?s=maotai&',
  },
  {
    key: 'wangwang',
    name: '旺旺短剧',
    apiBase: '/api/proxy?s=wangwang&',
  },
  {
    key: 'x',
    name: 'X资源站',
    apiBase: '/api/proxy?s=x&',
  },
];

export const getSourceByKey = (key: string): SourceConfig => {
  return SOURCES.find(s => s.key === key) || SOURCES[0];
};

// ---- Retry helper ----
const fetchWithRetry = async (url: string, retries = 3, delay = 1500): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch (e) {
      if (i === retries - 1) throw e;
    }
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Max retries reached');
};

// ---- Simple cache (5 min TTL) ----
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key: string) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
};

const setCache = (key: string, data: any) => {
  cache.set(key, { data, ts: Date.now() });
};


// ---- API Functions ----

// Known parent-child mapping for APIs that don't return type_pid
// Key = child type_id, Value = parent type_id
const WSY_PARENT_MAP: Record<number, number> = {
  // 电影(1) children
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 20: 1, 62: 1, 70: 1, 71: 1,
  // 电视剧(2) children
  13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 23: 2, 72: 2,
  // 综艺(3) children
  25: 3, 26: 3, 27: 3, 28: 3, 47: 3,
  // 动漫(4) children
  29: 4, 30: 4, 31: 4, 39: 4, 44: 4, 45: 4, 63: 4, 76: 4,
  // 体育赛事(48) children
  49: 48, 50: 48, 52: 48,
  // 伦理(55) children
  56: 55, 57: 55, 58: 55, 59: 55, 60: 55, 61: 55,
  // 爽文短剧(54) children
  64: 54, 65: 54, 66: 54, 67: 54, 68: 54, 69: 54, 73: 54,
};

export const fetchCategories = async (sourceKey: string): Promise<Category[]> => {
  try {
    const source = getSourceByKey(sourceKey);
    const url = `${source.apiBase}ac=list`;
    
    const cached = getCached(url);
    if (cached) return cached;

    const res = await fetchWithRetry(url);
    const data: ApiResponse = await res.json();
    const rawClass = data.class || [];

    // Check if any category has type_pid defined
    const hasPid = rawClass.some((c: any) => c.type_pid !== undefined);

    let result: Category[];
    if (hasPid) {
      const allIds = new Set(rawClass.map((c: any) => Number(c.type_id)));

      // API provides type_pid, use as-is but fix missing parents
      result = rawClass.map((c: any) => {
        let pid = Number(c.type_pid ?? 0);
        
        // Some MacCMS APIs set type_pid = type_id for root categories
        if (pid === Number(c.type_id)) {
          pid = 0;
        }
        
        // If the parent category doesn't exist in the data, treat this category as a root
        if (pid !== 0 && !allIds.has(pid)) {
          pid = 0;
        }
        return {
          type_id: Number(c.type_id),
          type_pid: pid,
          type_name: String(c.type_name),
        };
      });
    } else {
      // API doesn't provide type_pid, infer from known mapping
      const parentMap = source.key === 'wsy' ? WSY_PARENT_MAP : {};
      result = rawClass.map((c: any) => ({
        type_id: Number(c.type_id),
        type_pid: Number(parentMap[c.type_id] ?? 0),
        type_name: String(c.type_name),
      }));
    }
    
    setCache(url, result);
    return result;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
};

export interface FetchVideosOptions {
  page?: number;
  typeId?: number;
  keyword?: string;
  year?: string;
  area?: string;
}

export const fetchVideos = async (sourceKey: string, options: FetchVideosOptions = {}): Promise<ApiResponse | null> => {
  try {
    const source = getSourceByKey(sourceKey);
    const { page = 1, typeId, keyword, year, area } = options;

    const buildUrl = (pg: number) => {
      let url = `${source.apiBase}ac=detail&pg=${pg}`;
      if (typeId) url += `&t=${typeId}`;
      if (keyword) url += `&wd=${encodeURIComponent(keyword)}`;
      if (year) url += `&year=${encodeURIComponent(year)}`;
      if (area) url += `&area=${encodeURIComponent(area)}`;
      return url;
    };

    const url = buildUrl(page);

    // Check cache first (full result including client-side filtering)
    const cached = getCached(url);
    if (cached) return cached;

    const res = await fetchWithRetry(url);
    const data: ApiResponse = await res.json();

    // If no area filter, return as-is
    if (!area || !data.list || data.list.length === 0) {
      setCache(url, data);
      return data;
    }

    // Check if the API already filtered by area (all results match)
    const filtered = data.list.filter(v => v.vod_area && v.vod_area.includes(area));
    const apiSupportsArea = filtered.length === data.list.length;

    if (apiSupportsArea) {
      // API handled area filtering, no need for client-side work
      setCache(url, data);
      return data;
    }

    // API does NOT support area filtering — need to fetch more pages to fill results
    const TARGET = 20;
    const MAX_EXTRA_PAGES = 4; // fetch up to 4 extra pages (5 total)
    const accumulated: Video[] = [...filtered];
    const seen = new Set<number>(accumulated.map(v => v.vod_id));
    let maxPagecount = data.pagecount;
    let apiPage = page;

    while (accumulated.length < TARGET && apiPage - page < MAX_EXTRA_PAGES && apiPage < data.pagecount) {
      apiPage++;
      const nextUrl = buildUrl(apiPage);
      const nextCached = getCached(nextUrl);
      let nextData: ApiResponse;
      if (nextCached) {
        nextData = nextCached;
      } else {
        const nextRes = await fetchWithRetry(nextUrl);
        nextData = await nextRes.json();
        setCache(nextUrl, nextData); // cache raw page
      }
      if (!nextData.list || nextData.list.length === 0) break;
      for (const v of nextData.list) {
        if (!seen.has(v.vod_id) && v.vod_area && v.vod_area.includes(area)) {
          seen.add(v.vod_id);
          accumulated.push(v);
        }
      }
      if (nextData.pagecount > maxPagecount) maxPagecount = nextData.pagecount;
    }

    const result: ApiResponse = {
      ...data,
      list: accumulated,
      total: accumulated.length,
      pagecount: maxPagecount,
    };
    setCache(url, result);
    return result;
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return null;
  }
};

// Progressive callback type: called after each batch with accumulated results
export type OnProgressCallback = (result: ApiResponse) => void;

// Fetch videos from multiple sub-category IDs with throttling + streaming
// Each batch completes → immediately calls onProgress so UI updates progressively
export const fetchVideosByTypes = async (
  sourceKey: string,
  page = 1,
  typeIds: number[],
  onProgress?: OnProgressCallback
): Promise<ApiResponse | null> => {
  try {
    const source = getSourceByKey(sourceKey);
    const allVideos: Video[] = [];
    let maxPagecount = 1;
    let total = 0;
    const seen = new Set<number>();
    const batchSize = 2;
    const gapMs = 1500;

    for (let i = 0; i < typeIds.length; i += batchSize) {
      const batch = typeIds.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(id => {
          const url = `${source.apiBase}ac=detail&pg=${page}&t=${id}`;
          const cached = getCached(url);
          if (cached) return Promise.resolve(cached as ApiResponse);
          return fetchWithRetry(url)
            .then(r => r.json())
            .then(data => { setCache(url, data); return data as ApiResponse; })
            .catch(() => null);
        })
      );

      // Merge this batch into accumulated results
      for (const data of batchResults) {
        if (!data || !data.list) continue;
        for (const v of data.list) {
          if (!seen.has(v.vod_id)) {
            seen.add(v.vod_id);
            allVideos.push(v);
          }
        }
        if (data.pagecount > maxPagecount) maxPagecount = data.pagecount;
        total += data.total || 0;
      }

      // No sorting during streaming — new videos just append to the end
      // This prevents already-rendered cards from shifting position

      const progressResult: ApiResponse = {
        code: 1,
        msg: '数据列表',
        page,
        pagecount: maxPagecount,
        limit: 20,
        total,
        list: [...allVideos],
      };

      // Stream to UI immediately
      if (onProgress) {
        onProgress(progressResult);
      }

      // Wait between batches (skip after last batch)
      if (i + batchSize < typeIds.length) {
        await new Promise(r => setTimeout(r, gapMs));
      }
    }

    return {
      code: 1,
      msg: '数据列表',
      page,
      pagecount: maxPagecount,
      limit: 20,
      total,
      list: allVideos,
    };
  } catch (error) {
    console.error('Failed to fetch videos by types:', error);
    return null;
  }
};

export const fetchVideoDetail = async (sourceKey: string, id: number): Promise<Video | null> => {
  try {
    const source = getSourceByKey(sourceKey);
    const res = await fetchWithRetry(`${source.apiBase}ac=detail&ids=${id}`);
    const data: ApiResponse = await res.json();
    if (data.list && data.list.length > 0) {
      return data.list[0];
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch video detail:', error);
    return null;
  }
};
