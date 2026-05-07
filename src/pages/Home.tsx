import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchVideos, fetchVideosByTypes, fetchCategories, type Video, type Category } from '../api';
import { Play } from 'lucide-react';
import { useSource } from '../context/SourceContext';

const AREAS = [
  { label: '全部', value: '' },
  { label: '大陆', value: '大陆' },
  { label: '香港', value: '香港' },
  { label: '台湾', value: '台湾' },
  { label: '美国', value: '美国' },
  { label: '韩国', value: '韩国' },
  { label: '日本', value: '日本' },
  { label: '泰国', value: '泰国' },
  { label: '英国', value: '英国' },
  { label: '法国', value: '法国' },
  { label: '其他', value: '其他' },
];

const YEARS = [
  { label: '全部', value: '' },
  { label: '2026', value: '2026' },
  { label: '2025', value: '2025' },
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021', value: '2021' },
  { label: '2020', value: '2020' },
  { label: '2019', value: '2019' },
  { label: '2018', value: '2018' },
  { label: '2017', value: '2017' },
  { label: '2016', value: '2016' },
  { label: '2015', value: '2015' },
];

const Home: React.FC = () => {
  const { sourceKey } = useSource();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('wd') || '';
  const typeIdParam = searchParams.get('t');
  const typeId = typeIdParam ? parseInt(typeIdParam, 10) : undefined;
  const parentIdParam = searchParams.get('parent');
  const parentId = parentIdParam ? parseInt(parentIdParam, 10) : undefined;
  const pageParam = searchParams.get('pg');
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const area = searchParams.get('area') || undefined;
  const year = searchParams.get('year') || undefined;

  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  // Track which root category is expanded (for showing sub-categories)
  const [expandedRoot, setExpandedRoot] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const cats = await fetchCategories(sourceKey);
      setCategories(cats);
    };
    // Reset state when source changes
    setExpandedRoot(null);
    setVideos([]);
    loadData();
  }, [sourceKey]);

  // Reset expanded root if user navigates back to pure home (e.g. by clicking Logo)
  useEffect(() => {
    if (!typeId && !parentId && !keyword) {
      setExpandedRoot(null);
    }
  }, [typeId, parentId, keyword]);

  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      setLoading(true);
      setLoadingMore(false);
      setVideos([]);

      if (parentId) {
        // Fetch from all sub-categories of this parent, since the API stores
        // videos under sub-category IDs only (root category IDs return 0 results)
        const subIds = categories
          .filter(c => c.type_pid === parentId)
          .map(c => c.type_id);

        if (subIds.length > 0) {
          let firstBatch = true;
          await fetchVideosByTypes(sourceKey, page, subIds, (progress) => {
            if (!cancelled) {
              setVideos(progress.list);
              setTotalPages(progress.pagecount);
              if (firstBatch) {
                setLoading(false);
                firstBatch = false;
              }
            }
          });
          if (!cancelled) setLoading(false);
        } else {
          // Fallback: no sub-categories found yet, query directly
          const data = await fetchVideos(sourceKey, { page, typeId: parentId, year, area });
          if (!cancelled) {
            if (data) {
              setVideos(data.list);
              setTotalPages(data.pagecount);
            } else {
              setVideos([]);
            }
            setLoading(false);
          }
        }
      } else {
        const data = await fetchVideos(sourceKey, { page, typeId, keyword, year, area });
        if (!cancelled) {
          if (data) {
            setVideos(data.list);
            setTotalPages(data.pagecount);
          } else {
            setVideos([]);
          }
          setLoading(false);
        }
      }
    };

    loadVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => { cancelled = true; };
  }, [page, typeId, parentId, keyword, year, area, sourceKey]);

  // Root categories (type_pid === 0)
  const rootCategories = useMemo(() => categories.filter(c => c.type_pid === 0), [categories]);

  // Sub-categories of the currently expanded root
  const subCategories = useMemo(() => {
    if (expandedRoot === null) return [];
    return categories.filter(c => c.type_pid === expandedRoot);
  }, [categories, expandedRoot]);

  // Figure out which root category is "active" based on current typeId or parentId
  const activeRootId = useMemo(() => {
    if (parentId) return parentId;
    if (expandedRoot !== null) return expandedRoot;
    if (!typeId) return null;
    // Check if typeId is itself a root
    const isRoot = rootCategories.find(c => c.type_id === typeId);
    if (isRoot) return typeId;
    // Otherwise find the parent of the selected sub-category
    const sub = categories.find(c => c.type_id === typeId);
    if (sub) return sub.type_pid;
    return null;
  }, [typeId, parentId, rootCategories, categories, expandedRoot]);

  // When typeId changes, auto-expand the corresponding root
  useEffect(() => {
    if (!expandedRoot && typeId) {
      const sub = categories.find(c => c.type_id === typeId);
      if (sub && sub.type_pid !== 0) {
        setExpandedRoot(sub.type_pid);
      }
    }
  }, [typeId, categories]);

  // Check if a root category has sub-categories
  const hasChildren = (rootId: number) => categories.some(c => c.type_pid === rootId);

  // --- Helper: build new params while preserving area/year ---
  const buildParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    // Preserve area and year
    if (area) params.set('area', area);
    if (year) params.set('year', year);
    // Apply overrides
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) {
        params.set(k, v);
      }
    }
    return params;
  };

  const handleRootClick = (id: number) => {
    const hasSubs = hasChildren(id);

    if (hasSubs) {
      if (expandedRoot === id) {
        // Clicking the same root again collapses it
        setExpandedRoot(null);
        setSearchParams(buildParams({}));
      } else {
        // Expand sub-categories and show ALL content of this parent
        setExpandedRoot(id);
        setSearchParams(buildParams({ parent: id.toString() }));
      }
    } else {
      // Root without children (e.g., 伦理片), filter directly
      setExpandedRoot(null);
      setSearchParams(buildParams({ t: id.toString() }));
    }
  };

  const handleSubClick = (id: number) => {
    setSearchParams(buildParams({ t: id.toString() }));
  };

  const handleSubAllClick = () => {
    if (expandedRoot) {
      setSearchParams(buildParams({ parent: expandedRoot.toString() }));
    }
  };

  const handleAllClick = () => {
    setExpandedRoot(null);
    setSearchParams(buildParams({}));
  };

  const handleFilterClick = (key: 'area' | 'year', value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filter changes
    params.delete('pg');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const params = new URLSearchParams(searchParams);
    params.set('pg', newPage.toString());
    setSearchParams(params);
  };

  return (
    <div className="container animate-fade-in" style={styles.page}>
      {!keyword && (
        <div style={styles.categorySection} className="glass-panel category-section">
          {/* Root categories row */}
          <div style={styles.categoryWrap} className="category-wrap">
            <button
              className="category-btn"
              style={{
                ...styles.categoryBtn,
                backgroundColor: (!typeId && !parentId) ? 'var(--primary)' : 'transparent',
                color: (!typeId && !parentId) ? '#000' : 'var(--text-main)',
              }}
              onClick={handleAllClick}
            >
              全部
            </button>
            {rootCategories.map(cat => (
              <button
                key={cat.type_id}
                className="category-btn"
              style={{
                  ...styles.categoryBtn,
                  backgroundColor: activeRootId === cat.type_id ? 'var(--primary)' : 'transparent',
                  color: activeRootId === cat.type_id ? '#000' : 'var(--text-main)',
                }}
                onClick={() => handleRootClick(cat.type_id)}
              >
                {cat.type_name}
              </button>
            ))}
          </div>

          {/* Secondary Filters Panel (Sub-categories, Area & Year) */}
          <div style={styles.filtersWrap}>
            {/* Sub-categories row (only if a root with children is expanded) */}
            {subCategories.length > 0 && (
              <div style={styles.filterRow}>
                <span style={styles.filterLabel}>类型：</span>
                <div style={styles.filterOptions} className="filter-options">
                  <button
                    className="filter-btn"
                    style={{
                      ...styles.filterBtn,
                      backgroundColor: (parentId && !typeId) ? 'var(--primary)' : 'transparent',
                      color: (parentId && !typeId) ? '#000' : 'var(--text-main)',
                    }}
                    onClick={handleSubAllClick}
                  >
                    全部
                  </button>
                  {subCategories.map(cat => (
                    <button
                      key={cat.type_id}
                      className="filter-btn"
                      style={{
                        ...styles.filterBtn,
                        backgroundColor: typeId === cat.type_id ? 'var(--primary)' : 'transparent',
                        color: typeId === cat.type_id ? '#000' : 'var(--text-main)',
                      }}
                      onClick={() => handleSubClick(cat.type_id)}
                    >
                      {cat.type_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Area Row */}
            <div style={styles.filterRow}>
              <span style={styles.filterLabel}>地区：</span>
              <div style={styles.filterOptions} className="filter-options">
                {AREAS.map(a => (
                  <button
                    key={a.value}
                    className="filter-btn"
                    style={{
                      ...styles.filterBtn,
                      backgroundColor: (area === a.value) || (!area && a.value === '') ? 'var(--primary)' : 'transparent',
                      color: (area === a.value) || (!area && a.value === '') ? '#000' : 'var(--text-main)',
                    }}
                    onClick={() => handleFilterClick('area', a.value)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year Row */}
            <div style={styles.filterRow}>
              <span style={styles.filterLabel}>年份：</span>
              <div style={styles.filterOptions} className="filter-options">
                {YEARS.map(y => (
                  <button
                    key={y.value}
                    className="filter-btn"
                    style={{
                      ...styles.filterBtn,
                      backgroundColor: (year === y.value) || (!year && y.value === '') ? 'var(--primary)' : 'transparent',
                      color: (year === y.value) || (!year && y.value === '') ? '#000' : 'var(--text-main)',
                    }}
                    onClick={() => handleFilterClick('year', y.value)}
                  >
                    {y.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {keyword && (
        <h2 style={styles.searchTitle}>
          搜索结果: <span className="text-gradient">{keyword}</span>
        </h2>
      )}

      {loading ? (
        <div style={styles.loading}>正在加载影视资源...</div>
      ) : (
        <>
          {loadingMore && (
            <div style={styles.loadingMore}>
              <div style={styles.loadingMoreBar} />
              <span>正在加载更多资源...</span>
            </div>
          )}
          <div className="video-grid" style={styles.grid}>
            {videos.map(video => (
              <Link to={`/play/${video.vod_id}`} key={video.vod_id} style={styles.card} className="video-card">
                <div style={styles.posterWrapper}>
                  {video.vod_pic ? (
                    <img
                      src={video.vod_pic}
                      alt={video.vod_name}
                      style={styles.posterImg}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.add('show-fallback');
                      }}
                    />
                  ) : null}
                  <div style={styles.posterFallback} className={video.vod_pic ? '' : 'show-fallback'}>
                    <Play size={40} color="rgba(255,255,255,0.5)" />
                  </div>
                  <div style={styles.playOverlay} className="play-overlay">
                    <Play size={48} color="#fff" />
                  </div>
                  <div style={styles.remarks}>{video.vod_remarks || video.vod_time.split(' ')[0]}</div>
                </div>
                <div style={styles.cardContent}>
                  <h3 style={styles.title}>{video.vod_name}</h3>
                  <p style={styles.meta}>
                    <span style={styles.tag}>{video.type_name}</span>
                  </p>
                </div>
              </Link>
            ))}
            {videos.length === 0 && (
              <div style={styles.empty}>暂无数据</div>
            )}
          </div>

          {videos.length > 0 && (
            <div style={styles.pagination}>
              <button
                style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.5 : 1 }}
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                上一页
              </button>
              <span style={styles.pageInfo}>{page} / {totalPages}</span>
              <button
                style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.5 : 1 }}
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const styles = {
  page: {
    paddingTop: '20px',
    paddingBottom: '40px',
  },
  categorySection: {
    marginBottom: '32px',
    padding: '20px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  categoryWrap: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '16px',
    marginBottom: '4px',
  },
  categoryBtn: {
    padding: '8px 24px',
    borderRadius: '24px',
    fontSize: '15px',
    fontWeight: 600,
    transition: 'all 0.3s ease',
  },
  filtersWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  filterLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap' as const,
    minWidth: '36px',
  },
  filterOptions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    border: 'none',
    cursor: 'pointer',
  },
  searchTitle: {
    fontSize: '24px',
    marginBottom: '20px',
    fontWeight: 600,
  },
  loading: {
    textAlign: 'center' as const,
    padding: '60px',
    color: 'var(--text-muted)',
    fontSize: '16px',
  },
  loadingMore: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0 16px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    overflow: 'hidden',
  },
  loadingMoreBar: {
    flex: 1,
    height: '2px',
    background: `linear-gradient(90deg, var(--primary) 0%, transparent 100%)`,
    borderRadius: '1px',
    animation: 'shimmer 1.5s infinite',
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '60px',
    color: 'var(--text-muted)',
    fontSize: '16px',
  },
  streamingHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid var(--border-color)',
    borderTop: '2px solid var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  grid: {
    display: 'grid',
    // gridTemplateColumns will be overridden by CSS for mobile
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column' as const,
    textDecoration: 'none',
  },
  posterWrapper: {
    width: '100%',
    aspectRatio: '2/3',
    position: 'relative' as const,
    overflow: 'hidden',
    backgroundColor: '#1a1c23',
    borderRadius: '16px',
  },
  posterImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
    transition: 'transform 0.4s ease',
  },
  posterFallback: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(45deg, #2a2d36, #1a1c23)',
    display: 'none',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  remarks: {
    position: 'absolute' as const,
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(10px)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
  },
  cardContent: {
    padding: '16px 4px 8px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical' as const,
    color: 'var(--text-main)',
  },
  meta: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px',
  },
  tag: {
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    marginTop: '40px',
  },
  pageBtn: {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-main)',
    padding: '12px 28px',
    borderRadius: '24px',
    fontSize: '15px',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    border: '1px solid var(--border-color)',
  },
  pageInfo: {
    color: 'var(--text-muted)',
    fontSize: '14px',
  }
};

export default Home;
