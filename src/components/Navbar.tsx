import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Database, Check, Clock, Settings, ChevronRight, User as UserIcon, LogOut, Heart, Trash2, X, Sun, Moon } from 'lucide-react';
import { useSource } from '../context/SourceContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const Navbar: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSourceSub, setShowSourceSub] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Search history state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { sourceKey, setSourceKey, availableSources } = useSource();
  const { user, setUser } = useAuth();
  
  const [isLightTheme, setIsLightTheme] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightTheme]);

  const toggleTheme = () => {
    setIsLightTheme(prev => !prev);
  };
  
  const menuRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Load search history from localStorage
  const loadSearchHistory = () => {
    try {
      const raw = localStorage.getItem('qstv_search_history');
      if (raw) {
        setSearchHistory(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const addSearchTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const history = [...searchHistory].filter(t => t !== trimmed);
    history.unshift(trimmed);
    if (history.length > 8) history.length = 8;
    setSearchHistory(history);
    localStorage.setItem('qstv_search_history', JSON.stringify(history));
  };

  const removeSearchTerm = (term: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const history = searchHistory.filter(t => t !== term);
    setSearchHistory(history);
    localStorage.setItem('qstv_search_history', JSON.stringify(history));
  };

  const clearAllSearchTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('qstv_search_history');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      addSearchTerm(keyword.trim());
      navigate(`/?wd=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate('/');
    }
    setShowHistoryDropdown(false);
  };

  const handleHistoryItemClick = (term: string) => {
    setKeyword(term);
    addSearchTerm(term);
    navigate(`/?wd=${encodeURIComponent(term)}`);
    setShowHistoryDropdown(false);
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

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // settings menu close check
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
        setShowSourceSub(false);
      }
      // search history dropdown close check
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowHistoryDropdown(false);
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
          <img src="/logo.png" alt="QSTV Logo" style={{ height: '32px', width: '32px', objectFit: 'cover', borderRadius: '10px', boxShadow: '0 0 10px rgba(0, 122, 255, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)' }} />
          <span className="logo-text" style={{ color: 'var(--text-main)', letterSpacing: '2px', fontWeight: 800 }}>QSTV</span>
        </Link>

        <div className="nav-right-area" style={styles.rightArea}>
          <form onSubmit={handleSearch} className="nav-search-form" style={styles.searchForm}>
            <div style={styles.searchWrapper} ref={searchWrapperRef}>
              <Search size={18} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="搜索影视..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onFocus={() => setShowHistoryDropdown(true)}
                style={styles.searchInput}
                className="search-input-tv"
              />
              
              {/* Search History Dropdown Box */}
              {showHistoryDropdown && searchHistory.length > 0 && (
                <div style={styles.historyDropdown} className="glass-panel animate-fade-in search-history-panel">
                  <div style={styles.historyHeader}>
                    <span>最近搜索</span>
                    <button 
                      type="button" 
                      onClick={clearAllSearchTerms}
                      style={styles.historyClearBtn}
                    >
                      <Trash2 size={12} style={{ marginRight: '4px' }} />
                      清空历史
                    </button>
                  </div>
                  <div style={styles.historyList}>
                    {searchHistory.map((term, index) => (
                      <div 
                        key={index} 
                        style={styles.historyItem}
                        onClick={() => handleHistoryItemClick(term)}
                      >
                        <div style={styles.historyItemLeft}>
                          <Clock size={12} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                          <span style={styles.historyText}>{term}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeSearchTerm(term, e)}
                          style={styles.historyDeleteBtn}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Theme Toggle Button */}
          <button
            style={styles.themeToggleBtn}
            onClick={toggleTheme}
            title={isLightTheme ? "切换到深色模式" : "切换到浅色模式"}
          >
            {isLightTheme ? <Moon size={20} /> : <Sun size={20} />}
          </button>

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

                {/* Unified Space Center: History entry */}
                <Link
                  to="/history?tab=history"
                  style={styles.menuItem}
                  onClick={() => setShowSettingsMenu(false)}
                >
                  <div style={styles.menuItemLeft}>
                    <Clock size={16} />
                    <span>观看记录</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </Link>

                {/* Unified Space Center: Favorites entry */}
                <Link
                  to="/history?tab=bookmarks"
                  style={styles.menuItem}
                  onClick={() => setShowSettingsMenu(false)}
                >
                  <div style={styles.menuItemLeft}>
                    <Heart size={16} color="var(--primary)" />
                    <span>我的收藏</span>
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
    gap: '10px',
    fontSize: '24px',
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
  historyDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    borderRadius: '16px',
    padding: '12px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid var(--glass-border)',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    padding: '4px 6px 8px',
    borderBottom: '1px solid var(--border-color)',
  },
  historyClearBtn: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    transition: 'color 0.2s',
    background: 'none',
    border: 'none',
    fontSize: '12px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    marginTop: '6px',
    maxHeight: '260px',
    overflowY: 'auto' as const,
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.05)',
    }
  },
  historyItemLeft: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  historyText: {
    fontSize: '13px',
    color: 'var(--text-main)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  historyDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    marginLeft: '8px',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.1)',
      color: '#fff',
    }
  },
  themeToggleBtn: {
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
    marginRight: '8px',
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
    color: 'var(--text-main)',
  },
  menuDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 8px',
  },
};

export default Navbar;
