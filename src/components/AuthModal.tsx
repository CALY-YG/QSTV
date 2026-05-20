import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../utils/auth';
import { forceSyncWithCloud } from '../utils/history';
import { forceSyncBookmarksWithCloud } from '../utils/bookmarks';
import { LogIn, UserPlus, X } from 'lucide-react';


interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { setUser } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      let result;
      if (authMode === 'login') {
        result = await login(username, password);
      } else {
        result = await register(username, password);
      }
      setUser(result);
      setUsername('');
      setPassword('');
      await forceSyncWithCloud();
      await forceSyncBookmarksWithCloud();
      onClose(); // Close modal on success
    } catch (err: any) {
      setAuthError(err.message || '操作失败');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const modalContent = (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()} className="glass-panel">
        <button style={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>
        
        <div style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)' }}>
            {authMode === 'login' ? '账号登录' : '注册账号'}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            登录后即可解锁全部影视资源站，并开启云端历史同步功能。
          </p>
        </div>

        <form onSubmit={handleAuth} style={styles.form}>
          <div style={styles.tabs}>
            <button 
              type="button" 
              style={{...styles.tab, borderBottomColor: authMode === 'login' ? 'var(--primary)' : 'transparent', color: authMode === 'login' ? 'var(--primary)' : 'var(--text-muted)'}}
              onClick={() => {setAuthMode('login'); setAuthError('');}}
            >
              <LogIn size={16} /> 登录
            </button>
            <button 
              type="button" 
              style={{...styles.tab, borderBottomColor: authMode === 'register' ? 'var(--primary)' : 'transparent', color: authMode === 'register' ? 'var(--primary)' : 'var(--text-muted)'}}
              onClick={() => {setAuthMode('register'); setAuthError('');}}
            >
              <UserPlus size={16} /> 注册
            </button>
          </div>
          
          <input 
            type="text" 
            placeholder="用户名 (最少3字符)" 
            style={styles.input} 
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
          />
          <input 
            type="password" 
            placeholder="密码 (最少6字符)" 
            style={styles.input} 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          
          {authError && <div style={{ color: '#ff4d4f', fontSize: '13px' }}>{authError}</div>}
          
          <button type="submit" style={styles.submitBtn} disabled={authLoading}>
            {authLoading ? '处理中...' : (authMode === 'login' ? '立即登录' : '立即注册')}
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  modal: {
    width: '90%',
    maxWidth: '400px',
    padding: '32px',
    borderRadius: '24px',
    position: 'relative',
    backgroundColor: 'rgba(25, 28, 36, 0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  header: {
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '20px',
    marginBottom: '8px',
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  input: {
    padding: '14px 18px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  submitBtn: {
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#000',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '8px',
  },
};

export default AuthModal;
