import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Gauge } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  startTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  videoName?: string;
  episodeName?: string;
  episodeIndex?: number;
  episodeCount?: number;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  autoPlay?: boolean;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url, startTime = 0, onTimeUpdate, onEnded,
  videoName, episodeName, episodeIndex = 0, episodeCount = 0,
  onPrevEpisode, onNextEpisode, autoPlay = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const lastReportRef = useRef(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFS, setIsFS] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  
  // Advanced player states
  const [waiting, setWaiting] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hudMessage, setHudMessage] = useState('');
  const [hudKey, setHudKey] = useState(0);
  
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => { 
      if (playing) {
        setShowUI(false); 
        setShowSpeedMenu(false);
      }
    }, 3000);
  }, [playing]);

  const revealUI = useCallback(() => {
    setShowUI(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => { revealUI(); }, [url, revealUI]);
  useEffect(() => {
    const fn = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  // Global mouse up for drag end
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, []);

  // HUD controller
  const triggerHud = useCallback((msg: string) => {
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    setHudMessage(msg);
    setHudKey(prev => prev + 1);
    hudTimeoutRef.current = setTimeout(() => {
      setHudMessage('');
    }, 1200);
  }, []);

  // Ensure speed is maintained across HLS streams and reloads
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate, url, waiting]);

  // HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const seekTarget = startTime;
    let hasSeeked = false;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const doSeek = () => { if (seekTarget > 0 && !hasSeeked) { video.currentTime = seekTarget; hasSeeked = true; } };
    const save = () => { if (onTimeUpdateRef.current && video.currentTime > 0) onTimeUpdateRef.current(Math.floor(video.currentTime)); };
    
    const onTU = () => { 
      setCurTime(video.currentTime); 
      const n=Date.now(); 
      if(n-lastReportRef.current<5000)return; 
      lastReportRef.current=n; 
      save(); 
    };
    
    const onDur = () => setDuration(video.duration || 0);
    const onPlay = () => { setPlaying(true); setWaiting(false); };
    const onPause = () => { setPlaying(false); setShowUI(true); };
    const onEnd = () => { save(); setPlaying(false); if (onEndedRef.current) onEndedRef.current(); };
    
    // Waiting & Buffering listeners
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onSeeked = () => setWaiting(false);
    const onCanPlay = () => {
      setWaiting(false);
      video.playbackRate = playbackRate;
    };

    if (Hls.isSupported()) {
      class CPL extends (Hls.DefaultConfig.loader as any) {
        constructor(cfg: any) {
          super(cfg);
          const ol = this.load.bind(this);
          this.load = function(c: any, l: any, cb: any) {
            if (c.type === 'manifest' || c.type === 'level') {
              const oS = cb.onSuccess;
              cb.onSuccess = function(r: any, s: any, c2: any, n: any) {
                if (typeof r.data === 'string') {
                  const lines = r.data.split('\n');
                  const result: string[] = [];
                  const adKeywords = [
                    '/ad/', 'ad.ts', 'vip.ts', 'top.ts', 'logo.ts', 'pdd', 'taobao', 
                    'advertise', 'ad-segment', 'ads.', '/ads/', 'advert', 'juliang', 
                    'toutiao', 'byteimg', 'pangolin', 'gdt', 'tencent', 'alipay', 
                    'baidu', 'google', 'adsystem', 'adserver', 'segment-ad', 'promot',
                    'adv.ts', 'notice.ts', 'announcement', 'hbfile', 'hbdn', 'missevan'
                  ];

                  let i = 0;
                  while (i < lines.length) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXTINF')) {
                      let urlIdx = i + 1;
                      while (urlIdx < lines.length && (lines[urlIdx].trim().startsWith('#') || !lines[urlIdx].trim())) {
                        urlIdx++;
                      }
                      const segmentUrl = urlIdx < lines.length ? lines[urlIdx].trim() : '';
                      const isAd = adKeywords.some(keyword => segmentUrl.toLowerCase().includes(keyword.toLowerCase()));
                      if (isAd) {
                        i = urlIdx + 1;
                        continue;
                      }
                    }
                    result.push(lines[i]);
                    i++;
                  }

                  const cleanResult: string[] = [];
                  for (let j = 0; j < result.length; j++) {
                    const line = result[j].trim();
                    if (line === '#EXT-X-DISCONTINUITY') {
                      const prevLine = cleanResult[cleanResult.length - 1]?.trim();
                      if (prevLine === '#EXT-X-DISCONTINUITY') {
                        continue;
                      }
                    }
                    cleanResult.push(result[j]);
                  }

                  if (cleanResult.length > 0 && cleanResult[cleanResult.length - 1].trim() === '#EXT-X-DISCONTINUITY') {
                    cleanResult.pop();
                  }

                  r.data = cleanResult.join('\n');
                }
                oS(r, s, c2, n);
              };
            }
            ol(c, l, cb);
          };
        }
      }
      const hls = new Hls({ 
        maxMaxBufferLength: 60, 
        pLoader: CPL as any,
        startPosition: seekTarget > 0 ? seekTarget : -1
      });
      hlsRef.current = hls; hls.loadSource(url); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { 
        if (autoPlay) {
          video.play().catch(()=>{}); 
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) { 
      video.src = url; 
      if (autoPlay) {
        video.play().catch(()=>{});
      }
    }

    video.addEventListener('canplay', doSeek);
    video.addEventListener('canplaythrough', onCanPlay);
    video.addEventListener('timeupdate', onTU);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnd);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('seeked', onSeeked);
    
    window.addEventListener('beforeunload', save);
    return () => {
      save();
      video.removeEventListener('canplay', doSeek);
      video.removeEventListener('canplaythrough', onCanPlay);
      video.removeEventListener('timeupdate', onTU);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('seeked', onSeeked);
      
      window.removeEventListener('beforeunload', save);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url, startTime, autoPlay]);

  const togglePlay = () => { 
    const v=videoRef.current; 
    if(!v)return; 
    if (v.paused) {
      v.play().catch(()=>{});
      triggerHud('播放');
    } else {
      v.pause();
      triggerHud('暂停');
    }
  };

  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    if (muted) { 
      v.muted = false; 
      v.volume = volume || 0.5; 
      setMuted(false); 
      triggerHud(`音量 ${Math.round((volume || 0.5) * 100)}%`);
    } else { 
      v.muted = true; 
      setMuted(true); 
      triggerHud('静音');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current; if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val; v.muted = val === 0;
    setVolume(val); setMuted(val === 0);
    triggerHud(`音量 ${Math.round(val * 100)}%`);
  };

  const showVolSlider = () => {
    setShowVolume(true);
    if (volHideRef.current) clearTimeout(volHideRef.current);
  };

  const hideVolSlider = () => {
    volHideRef.current = setTimeout(() => setShowVolume(false), 300);
  };

  const handleSpeedSelect = (rate: number) => {
    const v = videoRef.current;
    if (v) {
      v.playbackRate = rate;
      setPlaybackRate(rate);
      triggerHud(`倍速: ${rate}x`);
    }
    setShowSpeedMenu(false);
  };

  const showSpeedOpts = () => {
    setShowSpeedMenu(true);
    if (speedHideRef.current) clearTimeout(speedHideRef.current);
  };

  const hideSpeedOpts = () => {
    speedHideRef.current = setTimeout(() => setShowSpeedMenu(false), 300);
  };

  const toggleFS = () => { 
    const c=containerRef.current; 
    if(!c)return; 
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(()=>{});
      triggerHud('退出全屏');
    } else {
      c.requestFullscreen().catch(()=>{});
      triggerHud('全屏');
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      const v = videoRef.current;
      const c = containerRef.current;
      if (!v || !c) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          if (v.paused) {
            v.play().catch(()=>{});
            triggerHud('播放');
          } else {
            v.pause();
            triggerHud('暂停');
          }
          revealUI();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          triggerHud('快退 -10s');
          revealUI();
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          triggerHud('快进 +10s');
          revealUI();
          break;
        case 'ArrowUp':
          e.preventDefault();
          const volUp = Math.min(1, v.volume + 0.05);
          v.volume = volUp;
          setVolume(volUp);
          if (volUp > 0) { v.muted = false; setMuted(false); }
          showVolSlider();
          hideVolSlider();
          triggerHud(`音量 ${Math.round(volUp * 100)}%`);
          revealUI();
          break;
        case 'ArrowDown':
          e.preventDefault();
          const volDown = Math.max(0, v.volume - 0.05);
          v.volume = volDown;
          setVolume(volDown);
          if (volDown === 0) { v.muted = true; setMuted(true); }
          showVolSlider();
          hideVolSlider();
          triggerHud(`音量 ${Math.round(volDown * 100)}%`);
          revealUI();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(()=>{});
            triggerHud('退出全屏');
          } else {
            c.requestFullscreen().catch(()=>{});
            triggerHud('全屏');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealUI, triggerHud]);

  const seekTo = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const bar = progressRef.current; const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    setCurTime(v.currentTime);
  };

  const hasPrev = episodeIndex > 0;
  const hasNext = episodeIndex < episodeCount - 1;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const titleLine = [videoName, episodeName ? `· ${episodeName}` : null, episodeCount > 1 ? `(${episodeIndex+1}/${episodeCount})` : null].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      style={styles.wrap}
      onMouseMove={revealUI}
      onTouchStart={revealUI}
    >
      <video
        ref={videoRef}
        style={styles.video}
        crossOrigin="anonymous"
        playsInline
        onClick={togglePlay}
      />

      {/* Title top-left */}
      {titleLine && <div style={{ ...styles.title, opacity: showUI ? 1 : 0 }}>{titleLine}</div>}

      {/* Buffering/Waiting loading indicator */}
      {waiting && (
        <div style={styles.loaderWrap}>
          <Loader2 size={48} className="spin-icon" style={{ animation: 'spin 1.6s linear infinite', color: 'var(--primary)' }} />
          <span style={{ fontSize: '13px', color: '#fff', marginTop: '10px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>正在加载缓冲分片...</span>
        </div>
      )}

      {/* Keyboard Control HUD Feedback Alert */}
      {hudMessage && (
        <div key={hudKey} className="player-hud">
          {hudMessage}
        </div>
      )}

      {/* Center play icon when paused & not buffering */}
      {!playing && !waiting && (
        <div style={styles.centerPlay} onClick={togglePlay}>
          <div style={styles.centerPlayCircle}>
            <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
          </div>
        </div>
      )}

      {/* ===== Bottom control bar ===== */}
      <div style={{ ...styles.bar, opacity: showUI ? 1 : 0, pointerEvents: showUI ? 'auto' : 'none' }}>

        {/* Progress bar (full width, on top of controls) */}
        <div
          ref={progressRef}
          style={styles.progressArea}
          onMouseEnter={() => setHoverProgress(true)}
          onMouseLeave={() => { setHoverProgress(false); setDragging(false); }}
          onClick={seekTo}
          onMouseDown={(e) => { setDragging(true); seekTo(e); }}
          onMouseMove={(e) => { if (dragging) seekTo(e); }}
          onTouchStart={(e) => { setDragging(true); seekTo(e); }}
          onTouchMove={(e) => { if (dragging) seekTo(e); }}
        >
          <div style={{ ...styles.trackBg, height: hoverProgress || dragging ? '6px' : '3px' }}>
            <div style={{ ...styles.trackFill, width: `${pct}%` }} />
            <div style={{
              ...styles.thumb,
              left: `${pct}%`,
              opacity: hoverProgress || dragging ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${hoverProgress || dragging ? 1 : 0.5})`,
            }} />
          </div>
        </div>

        {/* Controls row */}
        <div style={styles.row}>
          {/* Left: prev, play, next, time */}
          <div style={styles.left}>
            {episodeCount > 1 && (
              <button style={{ ...styles.iconBtn, opacity: hasPrev ? 1 : 0.3 }} disabled={!hasPrev}
                onClick={(e) => { e.stopPropagation(); onPrevEpisode?.(); }}>
                <SkipBack size={18} color="#fff" fill="#fff" />
              </button>
            )}
            <button style={styles.iconBtn} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
              {playing
                ? <Pause size={22} color="#fff" fill="#fff" />
                : <Play size={22} color="#fff" fill="#fff" style={{ marginLeft: '2px' }} />}
            </button>
            {episodeCount > 1 && (
              <button style={{ ...styles.iconBtn, opacity: hasNext ? 1 : 0.3 }} disabled={!hasNext}
                onClick={(e) => { e.stopPropagation(); onNextEpisode?.(); }}>
                <SkipForward size={18} color="#fff" fill="#fff" />
              </button>
            )}
            <span style={styles.time}>{fmt(currentTime)} / {fmt(duration)}</span>
          </div>

          {/* Right: speed control, volume (with slider) + fullscreen */}
          <div style={styles.right}>
            {/* Speed selection */}
            <div 
              style={styles.speedWrap}
              onMouseEnter={showSpeedOpts}
              onMouseLeave={hideSpeedOpts}
            >
              <button 
                style={styles.speedBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(v => !v);
                  setShowVolume(false);
                }}
              >
                <Gauge size={16} style={{ marginRight: '4px' }} />
                <span>{playbackRate === 1.0 ? '倍速' : `${playbackRate}x`}</span>
              </button>
              {showSpeedMenu && (
                <div style={styles.speedMenu}>
                  {[3.0, 2.5, 2.0, 1.5, 1.25, 1.0, 0.75, 0.5].map(rate => (
                    <button
                      key={rate}
                      style={{
                        ...styles.speedItem,
                        color: playbackRate === rate ? 'var(--primary)' : '#fff',
                        fontWeight: playbackRate === rate ? '700' : '500'
                      }}
                      onClick={() => handleSpeedSelect(rate)}
                    >
                      {rate === 1.0 ? '1.0x (原速)' : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume control */}
            <div
              style={styles.volWrap}
              onMouseEnter={showVolSlider}
              onMouseLeave={hideVolSlider}
            >
              <button 
                style={styles.iconBtn} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if ('ontouchstart' in window) {
                    setShowVolume(v => !v);
                    setShowSpeedMenu(false);
                  } else {
                    toggleMute(); 
                  }
                }}
              >
                {muted || volume === 0 ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
              </button>
              {showVolume && (
                <div style={styles.volSliderWrap}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    style={styles.volSlider}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
            <button style={styles.iconBtn} onClick={(e) => { e.stopPropagation(); toggleFS(); }}>
              {isFS ? <Minimize size={20} color="#fff" /> : <Maximize size={20} color="#fff" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#030305',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
    position: 'relative',
    userSelect: 'none',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    cursor: 'pointer',
  },
  title: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    padding: '16px 20px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'opacity 0.25s',
    pointerEvents: 'none',
    zIndex: 10,
  },
  loaderWrap: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 40,
    backdropFilter: 'blur(3px)',
  },
  centerPlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    cursor: 'pointer',
  },
  centerPlayCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(var(--primary-rgb), 0.85)',
    boxShadow: '0 0 20px var(--primary-glow-heavy)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'transform 0.2s ease',
    transform: 'scale(1)',
  },
  bar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
    paddingTop: '36px',
    transition: 'opacity 0.25s',
    zIndex: 10,
  },
  progressArea: {
    width: '100%',
    padding: '0 16px',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  trackBg: {
    position: 'relative',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '3px',
    transition: 'height 0.15s',
  },
  trackFill: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    backgroundColor: 'var(--primary)',
    borderRadius: '3px',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    border: '2px solid var(--primary)',
    boxShadow: '0 0 10px var(--primary-glow)',
    transition: 'opacity 0.15s, transform 0.15s, left 0.05s linear',
    pointerEvents: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px 10px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'background 0.15s',
  },
  time: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    marginLeft: '6px',
    opacity: 0.9,
  },
  speedWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  speedBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  speedMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(10, 8, 20, 0.92)',
    backdropFilter: 'blur(12px)',
    borderRadius: '10px',
    padding: '6px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(85px, 1fr))',
    gap: '4px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 20,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  speedItem: {
    padding: '6px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
    background: 'none',
    whiteSpace: 'nowrap',
  },
  volWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  volSliderWrap: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(10, 8, 20, 0.92)',
    borderRadius: '8px',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 20,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  volSlider: {
    writingMode: 'vertical-lr' as any,
    direction: 'rtl' as any,
    width: '4px',
    height: '80px',
    cursor: 'pointer',
    accentColor: 'var(--primary)',
  },
};

export default VideoPlayer;
