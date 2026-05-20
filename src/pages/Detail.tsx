import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchVideoDetail, fetchVideos, type Video } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import { ArrowLeft, ArrowDownUp, ChevronDown, Check, Heart } from 'lucide-react';
import { useSource } from '../context/SourceContext';
import { addHistory, getHistoryForVideo } from '../utils/history';
import { isBookmarked, addBookmark, removeBookmark } from '../utils/bookmarks';

interface Episode {
  name: string;
  url: string;
}

const Detail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { sourceKey, setSourceKey, availableSources } = useSource();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [reversed, setReversed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const playbackTimeRef = useRef(0);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const autoplay = searchParams.get('play') !== 'false';
  const sourceQuery = searchParams.get('source');
  const effectiveSource = (sourceQuery && availableSources.some(s => s.key === sourceQuery)) ? sourceQuery : sourceKey;

  // Sync sourceKey from URL if we came from history
  useEffect(() => {
    if (sourceQuery && sourceQuery !== sourceKey && availableSources.some(s => s.key === sourceQuery)) {
      setSourceKey(sourceQuery);
    }
  }, [sourceQuery, sourceKey, setSourceKey, availableSources]);

  // Close source menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) {
        setShowSourceMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll to details section if action=detail
  useEffect(() => {
    if (!loading && searchParams.get('action') === 'detail' && infoRef.current) {
      const timer = setTimeout(() => {
        infoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [searchParams, loading]);

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      const startTime = Date.now();
      const enforceMinDelay = async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed < 750) {
          await new Promise(resolve => setTimeout(resolve, 750 - elapsed));
        }
      };

      if (id) {
        const data = await fetchVideoDetail(effectiveSource, parseInt(id, 10));
        if (data) {
          setVideo(data);
          setBookmarked(isBookmarked(data.vod_id, effectiveSource));
          // Parse episodes from vod_play_url
          if (data.vod_play_url) {
            const sources = data.vod_play_url.split('$$$');
            const targetSource = sources.find(s => s.includes('.m3u8')) || sources[0];
            
            const epsList = targetSource.split('#').map(epStr => {
              const [name, url] = epStr.split('$');
              return { name, url };
            }).filter(ep => ep.url);
            
            // Auto-resume: check history for last watched episode + time
            const history = getHistoryForVideo(data.vod_id, effectiveSource);
            if (history && history.episodeIndex < epsList.length) {
              setCurrentEpisodeIndex(history.episodeIndex);
              setStartTime(history.playbackTime || 0);
            } else {
              setCurrentEpisodeIndex(0);
              setStartTime(0);
            }
            
            setEpisodes(epsList);
          }
        }
      }
      await enforceMinDelay();
      setLoading(false);
    };
    loadDetail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id, effectiveSource]);

  // Save to history whenever episode changes (preserve existing playbackTime)
  useEffect(() => {
    // Prevent saving history when transitioning between pages (old video state + new id/source)
    if (video && id && video.vod_id.toString() === id && episodes.length > 0 && episodes[currentEpisodeIndex]) {
      // Don't overwrite saved playbackTime — it may be the resume point we need
      const existing = getHistoryForVideo(video.vod_id, effectiveSource);
      const keepTime = (existing && existing.episodeIndex === currentEpisodeIndex)
        ? existing.playbackTime || 0
        : 0;
      addHistory({
        vodId: video.vod_id,
        vodName: video.vod_name,
        vodPic: video.vod_pic,
        typeName: video.type_name,
        sourceKey: effectiveSource,
        episodeIndex: currentEpisodeIndex,
        episodeName: episodes[currentEpisodeIndex].name,
        playbackTime: keepTime,
        watchedAt: Date.now(),
      });
    }
  }, [currentEpisodeIndex, video, episodes, effectiveSource, id]);

  // Called by VideoPlayer every ~5s and on pause/unload
  const handleTimeUpdate = useCallback((currentTime: number) => {
    playbackTimeRef.current = currentTime;
    if (video && id && video.vod_id.toString() === id && episodes.length > 0 && episodes[currentEpisodeIndex]) {
      addHistory({
        vodId: video.vod_id,
        vodName: video.vod_name,
        vodPic: video.vod_pic,
        typeName: video.type_name,
        sourceKey: effectiveSource,
        episodeIndex: currentEpisodeIndex,
        episodeName: episodes[currentEpisodeIndex].name,
        playbackTime: currentTime,
        watchedAt: Date.now(),
      });
    }
  }, [video, episodes, currentEpisodeIndex, effectiveSource, id]);

  // When user manually clicks an episode, reset startTime
  const handleEpisodeClick = (index: number) => {
    setStartTime(0);
    playbackTimeRef.current = 0;
    setCurrentEpisodeIndex(index);
  };

  // Auto-play next episode when current one ends
  const handleVideoEnded = useCallback(() => {
    if (currentEpisodeIndex < episodes.length - 1) {
      setStartTime(0);
      playbackTimeRef.current = 0;
      setCurrentEpisodeIndex(prev => prev + 1);
    }
  }, [currentEpisodeIndex, episodes.length]);

  const handleNextEpisode = () => {
    if (currentEpisodeIndex < episodes.length - 1) {
      handleEpisodeClick(currentEpisodeIndex + 1);
    }
  };

  const handlePrevEpisode = () => {
    if (currentEpisodeIndex > 0) {
      handleEpisodeClick(currentEpisodeIndex - 1);
    }
  };

  const handleSourceSwitch = async (newSourceKey: string) => {
    if (newSourceKey === effectiveSource || !video) return;
    
    setIsSwitchingSource(true);
    try {
      // Search the new source for the same video name
      const searchData = await fetchVideos(newSourceKey, { page: 1, keyword: video.vod_name });
      
      if (searchData && searchData.list && searchData.list.length > 0) {
        // Try to find exact match first, fallback to first result
        const match = searchData.list.find(v => v.vod_name === video.vod_name) || searchData.list[0];
        
        // Transfer the current playback progress to the new source before navigating
        // This ensures the new page will naturally resume from the exact episode and second
        addHistory({
          vodId: match.vod_id,
          vodName: match.vod_name,
          vodPic: match.vod_pic,
          typeName: match.type_name,
          sourceKey: newSourceKey,
          episodeIndex: currentEpisodeIndex,
          episodeName: episodes[currentEpisodeIndex]?.name || '',
          playbackTime: playbackTimeRef.current,
          watchedAt: Date.now(),
        });
        
        // Navigate to the matched video's detail page
        // The URL change will trigger the searchParams effect and update the global sourceKey naturally
        navigate(`/play/${match.vod_id}?source=${newSourceKey}`, { replace: true });
      } else {
        alert(`在选中的线路上未找到影片《${video.vod_name}》，请尝试其他线路。`);
      }
    } catch (error) {
      console.error('Source switch failed', error);
      alert('切换线路失败，请稍后重试');
    } finally {
      setIsSwitchingSource(false);
    }
  };

  const handleBookmarkToggle = () => {
    if (!video) return;
    
    setHeartAnimating(true);
    setTimeout(() => setHeartAnimating(false), 800);
    
    if (bookmarked) {
      removeBookmark(video.vod_id, effectiveSource);
      setBookmarked(false);
    } else {
      addBookmark({
        vodId: video.vod_id,
        vodName: video.vod_name,
        vodPic: video.vod_pic,
        typeName: video.type_name,
        sourceKey: effectiveSource,
      });
      setBookmarked(true);
    }
  };

  if (loading) {
    return <div style={styles.message}>正在加载详情...</div>;
  }

  if (!video) {
    return <div style={styles.message}>找不到该影视资源</div>;
  }

  const displayEpisodes = reversed ? [...episodes].reverse() : episodes;
  const currentUrl = episodes[currentEpisodeIndex]?.url || '';

  return (
    <div className="container animate-fade-in" style={styles.page}>
      {/* Top bar: back button left, source switcher right */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          返回
        </button>
        <div style={styles.sourceWrapper} ref={sourceMenuRef}>
          <button
            style={styles.sourceBtn}
            onClick={() => setShowSourceMenu(v => !v)}
          >
            <span style={styles.sourceBtnText}>
              {isSwitchingSource ? '切换中...' : (availableSources.find(s => s.key === effectiveSource)?.name || '切换资源')}
            </span>
            <ChevronDown size={14} style={{
              transition: 'transform 0.2s',
              transform: showSourceMenu ? 'rotate(180deg)' : 'rotate(0)',
            }} />
          </button>
          {showSourceMenu && (
            <div style={styles.sourceMenu} className="glass-panel">
              {availableSources.map(s => (
                <button
                  key={s.key}
                  style={{
                    ...styles.sourceMenuItem,
                    backgroundColor: effectiveSource === s.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  onClick={() => {
                    setShowSourceMenu(false);
                    handleSourceSwitch(s.key);
                  }}
                >
                  <span>{s.name}</span>
                  {effectiveSource === s.key && <Check size={14} color="var(--primary)" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.layout} className="detail-layout">
        <div style={styles.playerWrapper} className="detail-player-col">
          {currentUrl ? (
            <VideoPlayer
              url={currentUrl}
              startTime={startTime}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              videoName={video.vod_name}
              episodeName={episodes[currentEpisodeIndex]?.name}
              episodeIndex={currentEpisodeIndex}
              episodeCount={episodes.length}
              onPrevEpisode={handlePrevEpisode}
              onNextEpisode={handleNextEpisode}
              autoPlay={autoplay}
            />
          ) : (
            <div style={styles.noSource}>暂无可播放的片源</div>
          )}
        </div>

        <div style={styles.sideCol} className="glass-panel detail-episodes-col">
          <div style={styles.epsHeader}>
            <h3 style={styles.epsTitle}>
              选集 <span style={styles.epsCount}>({episodes.length})</span>
            </h3>
            <button
              style={{
                ...styles.sortBtn,
                color: reversed ? '#000' : 'var(--text-muted)',
                backgroundColor: reversed ? 'var(--primary)' : 'transparent',
                borderColor: reversed ? 'var(--primary)' : 'var(--border-color)',
              }}
              onClick={() => setReversed(r => !r)}
              title={reversed ? '正序' : '倒序'}
            >
              <ArrowDownUp size={16} />
              {reversed ? '倒序' : '正序'}
            </button>
          </div>
          <div style={styles.epsGrid}>
            {displayEpisodes.map((ep) => {
              const realIdx = episodes.indexOf(ep);
              return (
                <button
                  key={realIdx}
                  style={{
                    ...styles.epBtn,
                    backgroundColor: currentEpisodeIndex === realIdx ? 'var(--primary)' : 'transparent',
                    color: currentEpisodeIndex === realIdx ? '#000' : 'var(--text-main)',
                    borderColor: currentEpisodeIndex === realIdx ? 'var(--primary)' : 'var(--border-color)',
                  }}
                  onClick={() => handleEpisodeClick(realIdx)}
                >
                  {ep.name}
                </button>
              );
            })}
            {episodes.length === 0 && (
              <div style={{ color: 'var(--text-muted)' }}>无选集信息</div>
            )}
          </div>
        </div>

        {/* Video Info — direct child of layout grid, same column as player on desktop */}
        <div ref={infoRef} style={styles.info} className="glass-panel detail-info-col">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ ...styles.title, margin: 0 }}>{video.vod_name}</h1>
            <button 
              onClick={handleBookmarkToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                backgroundColor: bookmarked ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(255,255,255,0.02)',
                color: bookmarked ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.3s ease',
                fontSize: '14px',
                fontWeight: 600
              }}
              className={heartAnimating ? 'heart-beat' : ''}
            >
              <Heart 
                size={18} 
                fill={bookmarked ? 'var(--primary)' : 'none'} 
                color={bookmarked ? 'var(--primary)' : 'currentColor'} 
              />
              {bookmarked ? '已收藏' : '加入收藏'}
            </button>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.tag}>{video.type_name}</span>
            <span style={styles.tag}>{video.vod_area || '未知地区'}</span>
            <span style={styles.tag}>{video.vod_year || '未知年份'}</span>
          </div>
          
          {video.vod_director && (
            <p style={styles.descText}><strong>导演：</strong> {video.vod_director}</p>
          )}
          {video.vod_actor && (
            <p style={styles.descText}><strong>主演：</strong> {video.vod_actor}</p>
          )}
          
          <div style={styles.desc}>
            <h3 style={styles.descTitle}>剧情简介</h3>
            <div 
              style={styles.descText} 
              dangerouslySetInnerHTML={{ __html: video.vod_content || '暂无简介' }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    paddingTop: '20px',
    paddingBottom: '40px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sourceWrapper: {
    position: 'relative' as const,
  },
  sourceBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-main)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap' as const,
  },
  sourceBtnText: {
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  sourceMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '200px',
    borderRadius: '12px',
    padding: '6px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
    zIndex: 1001,
  },
  sourceMenuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    border: 'none',
    color: 'var(--text-main)',
  },
  message: {
    textAlign: 'center' as const,
    padding: '100px 0',
    color: 'var(--text-muted)',
    fontSize: '18px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    transition: 'color 0.3s ease',
  },
  layout: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '30px',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
  },
  mainCol: {
    flex: '1 1 700px',
    minWidth: 0,
  },
  sideCol: {
    flex: '0 0 350px',
    backgroundColor: 'var(--card-bg)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  playerWrapper: {
    marginBottom: '24px',
  },
  noSource: {
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'var(--text-muted)',
    marginBottom: '24px',
  },
  info: {
    marginTop: '24px',
    backgroundColor: 'var(--card-bg)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    marginBottom: '12px',
    color: 'var(--text-main)',
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  descTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginTop: '24px',
    marginBottom: '12px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '8px',
  },
  descText: {
    fontSize: '14px',
    lineHeight: '1.8',
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  desc: {
    marginTop: '20px',
  },
  epsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  epsTitle: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sortBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    transition: 'all 0.2s ease',
  },
  epsCount: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  epsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '10px',
    maxHeight: '600px',
    overflowY: 'auto' as const,
    paddingRight: '8px',
  },
  epBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '38px',
    padding: '0 8px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  }
};

export default Detail;
