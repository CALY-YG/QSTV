import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Film, Database, Check, Clock, Settings, ChevronRight, User as UserIcon, LogOut } from 'lucide-react';
import { useSource } from '../context/SourceContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const Navbar: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSourceSub, setShowSourceSub] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { sourceKey, setSourceKey, availableSources } = useSource();
  const { user, setUser } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/?wd=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate('/');
    }
  };

  // Sync keyword state with URL parameter so it clears when returning to home
  useEffect(() => {
    const wd = new URLSearchParams(location.search).get('wd');
    setKeyword(wd || '');
  }, [location.search]);

  const handleSourceChange = (key: string) => {
    setSourceKey(key);
    setShowSettingsMenu(false);
    setShowSourceSub(false);
    navigate('/');
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
        setShowSourceSub(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？退出后将无法在线同步观看记录。')) {
      setUser(null);
      setShowSettingsMenu(false);
    }
  };

  const currentSource = availableSources.find(s => s.key === sourceKey) || availableSources[0];

  return (
    <nav style={styles.nav} className="glass-panel">
      <div className="container nav-container" style={styles.container}>
        <Link to="/" style={styles.logo}>
          <Film size={28} color="var(--primary)" />
          <span style={{ color: 'var(--text-main)', letterSpacing: '2px' }}>QSTV</span>
        </Link>

        <div className="nav-right-area" style={styles.rightArea}>
          <form onSubmit={handleSearch} className="nav-search-form" style={styles.searchForm}>
            <div style={styles.searchWrapper}>
              <Search size={18} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="搜索你想看的影视资源..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={styles.searchInput}
                className="search-input-tv"
              />
            </div>
          </form>

          {/* Unified Settings Button */}
          <div style={styles.settingsSelector} ref={menuRef}>
            <button
              style={styles.settingsBtn}
              onClick={() => {
                setShowSettingsMenu(v => !v);
                setShowSourceSub(false);
              }}
            >
              <Settings size={20} style={{
                transition: 'transform 0.3s ease',
                transform: showSettingsMenu ? 'rotate(90deg)' : 'rotate(0)',
              }} />
            </button>

            {showSettingsMenu && (
              <div style={styles.settingsMenu} className="glass-panel">
                {/* Auth Entry */}
                {user ? (
                  <button
                    style={styles.menuItem}
                    onClick={handleLogout}
                  >
                    <div style={styles.menuItemLeft}>
                      <UserIcon size={16} />
                      <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.username}
                      </span>
                    </div>
                    <div style={styles.menuItemRight}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>退出登录</span>
                      <LogOut size={14} color="var(--text-muted)" />
                    </div>
                  </button>
                ) : (
                  <button
                    style={styles.menuItem}
                    onClick={() => {
                      setShowSettingsMenu(false);
                      setShowAuthModal(true);
                    }}
                  >
                    <div style={styles.menuItemLeft}>
                      <UserIcon size={16} />
                      <span>登录 / 注册</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </button>
                )}

                {/* Divider */}
                <div style={styles.menuDivider}></div>

                {/* History Entry */}
                <Link
                  to="/history"
                  style={styles.menuItem}
                  onClick={() => setShowSettingsMenu(false)}
                >
                  <div style={styles.menuItemLeft}>
                    <Clock size={16} />
                    <span>观看记录</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </Link>

                {/* Source Selector */}
                <button
                  style={{
                    ...styles.menuItem,
                    backgroundColor: showSourceSub ? 'var(--card-bg-hover)' : 'transparent',
                  }}
                  onClick={() => setShowSourceSub(v => !v)}
                >
                  <div style={styles.menuItemLeft}>
                    <Database size={16} />
                    <span>资源站</span>
                  </div>
                  <div style={styles.menuItemRight}>
                    <span style={styles.currentSourceBadge}>{currentSource.name}</span>
                    <ChevronRight size={14} color="var(--text-muted)" style={{
                      transition: 'transform 0.2s',
                      transform: showSourceSub ? 'rotate(90deg)' : 'rotate(0)',
                    }} />
                  </div>
                </button>

                {/* Source Sub-menu (inline expand) */}
                {showSourceSub && (
                  <div style={styles.sourceSubMenu}>
                    {availableSources.map(s => (
                      <button
                        key={s.key}
                        style={{
                          ...styles.sourceSubItem,
                          backgroundColor: sourceKey === s.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                        }}
                        onClick={() => handleSourceChange(s.key)}
                      >
                        <span>{s.name}</span>
                        {sourceKey === s.key && <Check size={14} color="var(--primary)" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </nav>
  );
};

const styles = {
  nav: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    minHeight: '80px',
    padding: '12px 0',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--glass-border)',
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '26px',
    fontWeight: 800,
    flexShrink: 0,
  },
  rightArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: '1 1 auto',
    justifyContent: 'flex-end',
  },
  searchForm: {
    flex: '1 1 400px',
    maxWidth: '500px',
    minWidth: '200px',
  },
  searchWrapper: {
    position: 'relative' as const,
    width: '100%',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
  },
  searchInput: {
    width: '100%',
    padding: '12px 20px 12px 48px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-main)',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.3s ease',
  },
  settingsSelector: {
    position: 'relative' as const,
    flexShrink: 0,
  },
  settingsBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-main)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  settingsMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 12px)',
    right: 0,
    minWidth: '240px',
    borderRadius: '16px',
    padding: '8px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    zIndex: 1001,
  },
  menuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    border: 'none',
    color: 'var(--text-main)',
    textDecoration: 'none',
    backgroundColor: 'transparent',
  },
  menuItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  menuItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  currentSourceBadge: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  sourceSubMenu: {
    padding: '4px 0 4px 26px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  sourceSubItem: {
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
    color: 'rgba(255,255,255,0.85)',
  },
  menuDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 8px',
  },
};

export default Navbar;
