import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchVideos, fetchVideosByTypes, fetchCategories, type Video, type Category } from '../api';
import { Play, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useSource } from '../context/SourceContext';
import { getBookmarks, addBookmark, removeBookmark } from '../utils/bookmarks';

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

const cleanDescription = (content?: string) => {
  if (!content) return '';
  return content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getStableColorFromUrl = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `${hue}, 85%, 55%`;
};

const getDominantColor = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve('210, 100%, 50%');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(getStableColorFromUrl(url));
          return;
        }
        ctx.drawImage(img, 0, 0, 16, 16);
        const imgData = ctx.getImageData(0, 0, 16, 16).data;
        
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i+1];
          const b = imgData[i+2];
          const a = imgData[i+3];
          
          if (a < 200) continue; // Skip transparent pixels
          
          // Skip pure gray/black/white
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 25 && (max < 30 || max > 225)) continue;
          
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
        
        if (count === 0) {
          // Fallback to simple average
          for (let i = 0; i < imgData.length; i += 4) {
            rSum += imgData[i];
            gSum += imgData[i+1];
            bSum += imgData[i+2];
            count++;
          }
        }
        
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);
        
        // Convert to HSL
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
            case gNorm: h = (bNorm - rNorm) / d + 2; break;
            case bNorm: h = (rNorm - gNorm) / d + 4; break;
          }
          h /= 6;
        }

        // Clamp saturation and lightness to make sure the tag color is visible and premium
        const hue = Math.round(h * 360);
        let sat = Math.round(s * 100);
        let light = Math.round(l * 100);
        
        if (sat < 40) sat = 75; // boost saturation if too gray
        if (light < 30) light = 45; // boost lightness if too dark
        if (light > 80) light = 60; // reduce lightness if too bright
        
        resolve(`${hue}, ${sat}%, ${light}%`);
      } catch (e) {
        resolve(getStableColorFromUrl(url));
      }
    };
    img.onerror = () => {
      resolve(getStableColorFromUrl(url));
    };
  });
};

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

  // Load local bookmarks to track which ones are currently bookmarked
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const refreshBookmarksState = () => {
    const list = getBookmarks();
    const currentSourceBookmarks = list.filter(b => b.sourceKey === sourceKey);
    setBookmarkedIds(new Set(currentSourceBookmarks.map(b => String(b.vodId))));
  };

  useEffect(() => {
    refreshBookmarksState();
  }, [sourceKey]);

  const handleBookmarkToggle = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCurrentlyBookmarked = bookmarkedIds.has(String(video.vod_id));
    if (isCurrentlyBookmarked) {
      removeBookmark(video.vod_id, sourceKey);
    } else {
      addBookmark({
        vodId: video.vod_id,
        vodName: video.vod_name,
        vodPic: video.vod_pic,
        typeName: video.type_name,
        sourceKey: sourceKey,
      });
    }
    refreshBookmarksState();
  };

  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      setLoading(true);
      setLoadingMore(false);
      setVideos([]);

      const startTime = Date.now();
      const enforceMinDelay = async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed < 750) {
          await new Promise(resolve => setTimeout(resolve, 750 - elapsed));
        }
      };

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
                enforceMinDelay().then(() => {
                  if (!cancelled) setLoading(false);
                });
                firstBatch = false;
              }
            }
          });
          await enforceMinDelay();
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
            await enforceMinDelay();
            if (!cancelled) setLoading(false);
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
          await enforceMinDelay();
          if (!cancelled) setLoading(false);
        }
      }
    };

    loadVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => { cancelled = true; };
  }, [page, typeId, parentId, keyword, year, area, sourceKey, categories]);

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

  // Carousel State for Featured Hero Banner
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  // Dynamically select 5 random featured videos whenever videos (or category) changes
  const featuredVideos = useMemo(() => {
    // Only show banner on first page when not searching
    if (videos.length === 0 || keyword || page !== 1) return [];
    // Shuffle a copy of the videos array and take up to 5 items
    const shuffled = [...videos].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(5, videos.length));
  }, [videos, keyword, page]);

  // Reset rotation index when the filter/category changes
  useEffect(() => {
    setCurrentHeroIndex(0);
  }, [typeId, parentId, keyword, year, area, sourceKey]);

  // Automatic slideshow rotation every 5 seconds (resets when index changes manually)
  useEffect(() => {
    if (featuredVideos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredVideos.length, currentHeroIndex]);

  const featuredVideo = featuredVideos[currentHeroIndex] || null;

  // Touch Swipe Gestures for Hero Banner on Mobile
  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX; // initialize
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { // threshold of 50px
      if (diff > 0) {
        setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
      } else {
        setCurrentHeroIndex((prev) => (prev - 1 + featuredVideos.length) % featuredVideos.length);
      }
    }
  };

  const [themeColorRaw, setThemeColorRaw] = useState('210, 100%, 50%');

  useEffect(() => {
    if (featuredVideo && featuredVideo.vod_pic) {
      getDominantColor(featuredVideo.vod_pic).then((color) => {
        setThemeColorRaw(color);
      });
    }
  }, [featuredVideo]);

  // Filter out ALL carousel featured movies from the grid catalog to avoid flickering or duplication
  const displayVideos = useMemo(() => {
    if (featuredVideos.length === 0) return videos;
    const featuredIds = new Set(featuredVideos.map(v => v.vod_id));
    return videos.filter(v => !featuredIds.has(v.vod_id));
  }, [videos, featuredVideos]);

  const activeStyle = {
    background: 'linear-gradient(135deg, var(--primary) 0%, #00d2ff 100%)',
    color: '#ffffff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px var(--primary-glow)',
    fontWeight: 700,
    cursor: 'pointer',
  };

  const inactiveStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-muted)',
    borderColor: 'var(--border-color)',
    cursor: 'pointer',
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
                ...((!typeId && !parentId) ? activeStyle : inactiveStyle),
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
                  ...(activeRootId === cat.type_id ? activeStyle : inactiveStyle),
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
                      ...((parentId && !typeId) ? activeStyle : inactiveStyle),
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
                        ...(typeId === cat.type_id ? activeStyle : inactiveStyle),
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
                      ...(((area === a.value) || (!area && a.value === '')) ? activeStyle : inactiveStyle),
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
                      ...(((year === y.value) || (!year && y.value === '')) ? activeStyle : inactiveStyle),
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

      {featuredVideo && (
        <div 
          className="hero-banner" 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            ...styles.heroBannerOverride, 
            ['--theme-color-raw' as any]: themeColorRaw 
          }}
        >
          {/* Transition wrapper keyed on video ID to fire smooth CSS fade-in on slide change */}
          <div key={featuredVideo.vod_id} className="animate-fade-in" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
            {/* Ambient blurred backdrop of the poster */}
            <div 
              className="hero-bg" 
              style={{ 
                backgroundImage: `url(${featuredVideo.vod_pic || ''})`,
                filter: 'blur(55px) brightness(0.65) saturate(1.7)',
                transform: 'scale(1.15)',
                opacity: 0.95,
                width: '100%',
                height: '100%',
                position: 'absolute',
                inset: 0
              }} 
            />
            {/* Frosted Glass Overlay */}
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--hero-glass-overlay)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            />
            {/* Left Vignette for readability */}
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--hero-vignette)',
                pointerEvents: 'none',
              }}
            />
            
            <div style={styles.heroLayout} className="hero-layout-row">
              {/* Left Column: Movie Info Details */}
              <div style={styles.heroLeft} className="hero-left-col">
                <span className="hero-tag" style={styles.heroTagOverride}>{featuredVideo.type_name}</span>
                <h1 className="hero-title" style={styles.heroTitleOverride}>{featuredVideo.vod_name}</h1>
                <p className="hero-desc" style={styles.heroDescOverride}>
                  {featuredVideo.vod_content 
                    ? cleanDescription(featuredVideo.vod_content)
                    : `${featuredVideo.vod_name}，最新高清影视资源在线观看。`
                  }
                </p>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '4px' }}>
                  <Link to={`/play/${featuredVideo.vod_id}?play=true`} className="hero-play-btn" style={styles.heroPlayBtnOverride}>
                    <Play size={16} fill="currentColor" />
                    立即播放
                  </Link>
                  <Link to={`/play/${featuredVideo.vod_id}?play=false&action=detail`} className="hero-detail-btn" style={styles.heroDetailBtn}>
                    查看详情
                  </Link>
                </div>
              </div>
              
              {/* Right Column: Crisp vertical poster card in correct 2:3 aspect ratio */}
              <div style={styles.heroRight} className="hero-right-poster-container">
                <div style={styles.heroPosterCard} className="video-card">
                  <img 
                    src={featuredVideo.vod_pic} 
                    alt={featuredVideo.vod_name} 
                    style={styles.heroPosterImage}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div style={styles.heroPosterGlow} />

                  {/* Floating Bookmark Button on Carousel Poster */}
                  <button
                    onClick={(e) => handleBookmarkToggle(featuredVideo, e)}
                    className={`poster-bookmark-btn ${bookmarkedIds.has(String(featuredVideo.vod_id)) ? 'active' : ''}`}
                    title={bookmarkedIds.has(String(featuredVideo.vod_id)) ? "取消收藏" : "收藏影视"}
                  >
                    <Heart
                      size={16}
                      fill={bookmarkedIds.has(String(featuredVideo.vod_id)) ? '#ff3b30' : 'none'}
                      color={bookmarkedIds.has(String(featuredVideo.vod_id)) ? '#ff3b30' : 'rgba(255, 255, 255, 0.85)'}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Left Arrow Button */}
          {featuredVideos.length > 1 && (
            <button
              onClick={() => setCurrentHeroIndex((prev) => (prev - 1 + featuredVideos.length) % featuredVideos.length)}
              className="hero-arrow-btn hero-arrow-left"
              aria-label="Previous Slide"
            >
              <ChevronLeft size={40} />
            </button>
          )}

          {/* Right Arrow Button */}
          {featuredVideos.length > 1 && (
            <button
              onClick={() => setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length)}
              className="hero-arrow-btn hero-arrow-right"
              aria-label="Next Slide"
            >
              <ChevronRight size={40} />
            </button>
          )}

          {/* Glassy Slide Indicator Dots */}
          {featuredVideos.length > 1 && (
            <div style={styles.indicatorWrap} className="hero-indicator-dots">
              {featuredVideos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentHeroIndex(idx)}
                  style={{
                    ...styles.indicatorDot,
                    backgroundColor: idx === currentHeroIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    boxShadow: idx === currentHeroIndex ? '0 0 10px rgba(255, 255, 255, 0.6)' : 'none',
                    width: idx === currentHeroIndex ? '20px' : '8px',
                  }}
                  title={`切换至第 ${idx + 1} 张`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {keyword && (
        <h2 style={styles.searchTitle}>
          搜索结果: <span className="text-gradient">{keyword}</span>
        </h2>
      )}

      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-poster" />
              <div className="skeleton-title" />
              <div className="skeleton-tag" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {loadingMore && (
            <div style={styles.loadingMore}>
              <div style={styles.loadingMoreBar} />
              <span>正在加载更多资源...</span>
            </div>
          )}
          <div className="video-grid" style={styles.grid}>
            {displayVideos.map(video => (
              <Link to={`/play/${video.vod_id}`} key={video.vod_id} style={styles.card} className="video-card">
                <div style={styles.posterWrapper} className="poster-wrapper">
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

                  {/* Floating Bookmark Button */}
                  <button
                    onClick={(e) => handleBookmarkToggle(video, e)}
                    className={`poster-bookmark-btn ${bookmarkedIds.has(String(video.vod_id)) ? 'active' : ''}`}
                    title={bookmarkedIds.has(String(video.vod_id)) ? "取消收藏" : "收藏影视"}
                  >
                    <Heart
                      size={16}
                      fill={bookmarkedIds.has(String(video.vod_id)) ? '#ff3b30' : 'none'}
                      color={bookmarkedIds.has(String(video.vod_id)) ? '#ff3b30' : 'rgba(255, 255, 255, 0.85)'}
                    />
                  </button>
                </div>
                <div style={styles.cardContent}>
                  <h3 style={styles.title}>{video.vod_name}</h3>
                  <p style={styles.meta}>
                    <span style={styles.tag}>{video.type_name}</span>
                  </p>
                </div>
              </Link>
            ))}
            {displayVideos.length === 0 && (
              <div style={styles.empty}>暂无数据</div>
            )}
          </div>

          {displayVideos.length > 0 && (
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
    animation: 'spin 1.4s linear infinite',
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
  },
  heroBannerOverride: {
    position: 'relative' as const,
    width: '100%',
    height: '420px',
    borderRadius: '24px',
    overflow: 'hidden',
    marginBottom: '36px',
    boxShadow: 'var(--hero-banner-shadow)',
    border: '1px solid var(--hero-banner-border)',
    background: 'var(--hero-banner-bg)',
  },
  heroOverlayOverride: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(to right, rgba(6, 9, 19, 0.95) 0%, rgba(6, 9, 19, 0.75) 45%, rgba(6, 9, 19, 0.2) 75%, rgba(6, 9, 19, 0.6) 100%), linear-gradient(to top, rgba(6, 9, 19, 1) 0%, rgba(6, 9, 19, 0.1) 60%, transparent 100%)',
  },
  heroLayout: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 48px',
    zIndex: 10,
    gap: '40px',
  },
  heroLeft: {
    flex: '1 1 50%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    zIndex: 12,
  },
  heroTagOverride: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
    width: 'fit-content',
    letterSpacing: '1px',
  },
  heroTitleOverride: {
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1.25,
    color: 'var(--hero-text-title)',
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
  },
  heroDescOverride: {
    fontSize: '15px',
    color: 'var(--hero-text-desc)',
    lineHeight: '1.7',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    maxHeight: '76px',
  },
  heroPlayBtnOverride: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--hero-play-bg)',
    color: 'var(--hero-play-color)',
    padding: '12px 28px',
    borderRadius: '24px',
    fontWeight: 700,
    fontSize: '15px',
    transition: 'all 0.3s ease',
    width: 'fit-content',
    boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
  },
  heroDetailBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--hero-detail-bg)',
    border: '1px solid var(--hero-detail-border)',
    color: 'var(--hero-detail-color)',
    padding: '11px 26px',
    borderRadius: '24px',
    fontWeight: 600,
    fontSize: '15px',
    transition: 'all 0.3s ease',
    width: 'fit-content',
    backdropFilter: 'blur(8px)',
  },
  heroRight: {
    flex: '0 0 270px',
    height: '370px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
  },
  heroPosterCard: {
    position: 'relative' as const,
    width: '252px',
    height: '360px',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  heroPosterGlow: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
    pointerEvents: 'none' as const,
  },
  indicatorWrap: {
    position: 'absolute' as const,
    bottom: '20px',
    left: '48px',
    display: 'flex',
    gap: '6px',
    zIndex: 15,
  },
  indicatorDot: {
    height: '8px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  }
};

export default Home;
