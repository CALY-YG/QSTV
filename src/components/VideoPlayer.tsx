import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

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
  onPrevEpisode, onNextEpisode,
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
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => { if (playing) setShowUI(false); }, 3000);
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

  // HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const seekTarget = startTime;
    let hasSeeked = false;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const doSeek = () => { if (seekTarget > 0 && !hasSeeked) { video.currentTime = seekTarget; hasSeeked = true; } };
    const save = () => { if (onTimeUpdateRef.current && video.currentTime > 0) onTimeUpdateRef.current(Math.floor(video.currentTime)); };
    const onTU = () => { setCurTime(video.currentTime); const n=Date.now(); if(n-lastReportRef.current<5000)return; lastReportRef.current=n; save(); };
    const onDur = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowUI(true); };
    const onEnd = () => { save(); setPlaying(false); if (onEndedRef.current) onEndedRef.current(); };

    if (Hls.isSupported()) {
      class CPL extends (Hls.DefaultConfig.loader as any) {
        constructor(cfg: any) {
          super(cfg);
          const ol = this.load.bind(this);
          this.load = function(c:any,l:any,cb:any){
            if(c.type==='manifest'||c.type==='level'){const oS=cb.onSuccess;cb.onSuccess=function(r:any,s:any,c2:any,n:any){if(typeof r.data==='string'){const ls=r.data.split('\n');const cl:string[]=[];let sk=false;for(let i=0;i<ls.length;i++){const ln=ls[i].trim();if(ln.startsWith('#EXTINF')){const nx=ls[i+1]?.trim()||'';if(['/ad/','ad.ts','vip.ts','top.ts','logo.ts','pdd','taobao','advertise'].some(k=>nx.includes(k))){sk=true;continue;}}if(sk){sk=false;continue;}cl.push(ls[i]);}r.data=cl.join('\n');}oS(r,s,c2,n);};}
            ol(c,l,cb);
          };
        }
      }
      const hls = new Hls({ 
        maxMaxBufferLength: 60, 
        pLoader: CPL as any,
        startPosition: seekTarget > 0 ? seekTarget : -1
      });
      hlsRef.current = hls; hls.loadSource(url); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(()=>{}); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) { 
      video.src = url; 
    }

    video.addEventListener('canplay', doSeek);
    video.addEventListener('timeupdate', onTU);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnd);
    window.addEventListener('beforeunload', save);
    return () => {
      save();
      video.removeEventListener('canplay', doSeek);
      video.removeEventListener('timeupdate', onTU);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnd);
      window.removeEventListener('beforeunload', save);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url, startTime]);

  const togglePlay = () => { const v=videoRef.current; if(!v)return; v.paused?v.play().catch(()=>{}):v.pause(); };
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    if (muted) { v.muted = false; v.volume = volume || 0.5; setMuted(false); }
    else { v.muted = true; setMuted(true); }
  };
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current; if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val; v.muted = val === 0;
    setVolume(val); setMuted(val === 0);
  };
  const showVolSlider = () => {
    setShowVolume(true);
    if (volHideRef.current) clearTimeout(volHideRef.current);
  };
  const hideVolSlider = () => {
    volHideRef.current = setTimeout(() => setShowVolume(false), 300);
  };
  const toggleFS = () => { const c=containerRef.current; if(!c)return; document.fullscreenElement?document.exitFullscreen().catch(()=>{}):c.requestFullscreen().catch(()=>{}); };

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

      {/* Center play icon when paused */}
      {!playing && (
        <div style={styles.centerPlay} onClick={togglePlay}>
          <Play size={40} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
        </div>
      )}

      {/* ===== Bilibili-style bottom control bar ===== */}
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

        {/* Controls row: bilibili layout */}
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

          {/* Right: volume (with slider) + fullscreen */}
          <div style={styles.right}>
            <div
              style={styles.volWrap}
              onMouseEnter={showVolSlider}
              onMouseLeave={hideVolSlider}
            >
              <button style={styles.iconBtn} onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
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
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    position: 'relative',
    userSelect: 'none',
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
    padding: '14px 16px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'opacity 0.25s',
    pointerEvents: 'none',
    zIndex: 10,
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
  bar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 70%, transparent 100%)',
    paddingTop: '30px',
    transition: 'opacity 0.25s',
    zIndex: 10,
  },
  progressArea: {
    width: '100%',
    padding: '0 12px',
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
    backgroundColor: '#00a1d6',
    borderRadius: '3px',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#00a1d6',
    transition: 'opacity 0.15s, transform 0.15s, left 0.05s linear',
    boxShadow: '0 0 4px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px 8px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
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
  volWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  volSliderWrap: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderRadius: '8px',
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: 20,
  },
  volSlider: {
    writingMode: 'vertical-lr' as any,
    direction: 'rtl' as any,
    width: '4px',
    height: '80px',
    cursor: 'pointer',
    accentColor: '#00a1d6',
  },
};

export default VideoPlayer;
