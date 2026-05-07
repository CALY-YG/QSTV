import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getHistory, removeHistory, clearAllHistory, forceSyncWithCloud, type HistoryItem } from '../utils/history';
import { Play, Trash2, Clock, X, RefreshCw } from 'lucide-react';
import { SOURCES } from '../api';
import { useAuth } from '../context/AuthContext';

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();

  const loadHistory = () => {
    setHistory(getHistory());
  };

  // On mount: load local first, then sync with cloud if logged in
  useEffect(() => {
    loadHistory();
    if (user) {
      setSyncing(true);
      forceSyncWithCloud()
        .then(() => loadHistory())
        .catch(console.error)
        .finally(() => setSyncing(false));
    }
  }, [user]);

  const handleRemove = (item: HistoryItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeHistory(item.vodId, item.sourceKey);
    loadHistory();
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清空所有观看记录吗？')) {
      clearAllHistory();
      setHistory([]);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHr < 24) return `${diffHr}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const getSourceName = (key: string) => {
    return SOURCES.find(s => s.key === key)?.name || key;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 1) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="container animate-fade-in" style={styles.page}>

      <div style={styles.header}>
        <h1 style={styles.title}>
          <Clock size={24} color="var(--primary)" />
          观看记录
          <span style={styles.count}>({history.length})</span>
          {syncing && <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 400 }}>同步中...</span>}
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {user && (
            <button
              style={styles.clearBtn}
              onClick={() => {
                setSyncing(true);
                forceSyncWithCloud()
                  .then(() => loadHistory())
                  .catch(console.error)
                  .finally(() => setSyncing(false));
              }}
              disabled={syncing}
            >
              <RefreshCw size={16} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              云同步
            </button>
          )}
          {history.length > 0 && (
            <button style={styles.clearBtn} onClick={handleClearAll}>
              <Trash2 size={16} />
              清空记录
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div style={styles.empty}>
          <Clock size={48} color="var(--border-color)" />
          <p>暂无观看记录</p>
          <Link to="/" style={styles.goHomeBtn}>去看点什么</Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {history.map((item) => (
            <Link
              to={`/play/${item.vodId}?source=${item.sourceKey}`}
              key={`${item.vodId}-${item.sourceKey}`}
              style={styles.card}
              className="video-card"
            >
              <div style={styles.posterWrapper}>
                {item.vodPic ? (
                  <img
                    src={item.vodPic}
                    alt={item.vodName}
                    style={styles.posterImg}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.add('show-fallback');
                    }}
                  />
                ) : null}
                <div style={styles.posterFallback} className={item.vodPic ? '' : 'show-fallback'}>
                  <Play size={40} color="rgba(255,255,255,0.5)" />
                </div>
                <div style={styles.playOverlay} className="play-overlay">
                  <Play size={48} color="#fff" />
                </div>
                {/* Resume badge */}
                <div style={styles.resumeBadge}>
                  ▶ {item.episodeName}
                  {item.playbackTime > 0 && (
                    <span style={{ opacity: 0.85, fontWeight: 400 }}>
                      {' · 看到 '}{formatDuration(item.playbackTime)}
                    </span>
                  )}
                </div>
                {/* Remove button */}
                <button
                  style={styles.removeBtn}
                  onClick={(e) => handleRemove(item, e)}
                  title="删除记录"
                >
                  <X size={14} />
                </button>
              </div>
              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>{item.vodName}</h3>
                <div style={styles.cardMeta}>
                  <span style={styles.tag}>{item.typeName}</span>
                  <span style={styles.time}>{formatTime(item.watchedAt)}</span>
                </div>
                <div style={styles.sourceName}>{getSourceName(item.sourceKey)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    paddingTop: '20px',
    paddingBottom: '40px',
  },
  settingsPanel: {
    padding: '24px',
    borderRadius: '16px',
    marginBottom: '32px',
    backgroundColor: 'var(--card-bg)',
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '12px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  userAvatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary) 0%, #00d2ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  authContainer: {
    display: 'flex',
    gap: '40px',
    flexWrap: 'wrap',
  },
  authDesc: {
    flex: '1 1 300px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
  },
  authForm: {
    flex: '1 1 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  authTabs: {
    display: 'flex',
    gap: '20px',
    marginBottom: '8px',
  },
  authTab: {
    background: 'none',
    border: 'none',
    padding: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  authInput: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-main)',
    color: 'var(--text-main)',
    fontSize: '14px',
    outline: 'none',
  },
  authSubmitBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#000',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-main)',
  },
  count: {
    fontSize: '16px',
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '100px 0',
    color: 'var(--text-muted)',
    fontSize: '16px',
  },
  goHomeBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#000',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    textDecoration: 'none',
    position: 'relative',
  },
  posterWrapper: {
    width: '100%',
    aspectRatio: '2/3',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1a1c23',
    borderRadius: '16px',
  },
  posterImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'transform 0.4s ease',
  },
  posterFallback: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(45deg, #2a2d36, #1a1c23)',
    display: 'none',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  resumeBadge: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    right: '8px',
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(10px)',
    color: '#000',
    padding: '6px 10px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 0.2s ease',
  },
  cardContent: {
    padding: '16px 4px 8px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    color: 'var(--text-main)',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'var(--text-muted)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  time: {
    color: 'var(--text-muted)',
  },
  sourceName: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    opacity: 0.6,
  },
};

export default History;
