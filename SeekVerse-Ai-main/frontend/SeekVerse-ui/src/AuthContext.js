import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Auth0Provider as RealAuth0Provider, useAuth0 as useRealAuth0 } from '@auth0/auth0-react';

const UnifiedAuthContext = createContext(null);

const isRealAuth0 = (domain) => {
  if (!domain) return false;
  const d = domain.trim().toLowerCase();
  return !d.includes('placeholder') && d.includes('.');
};

function LoginModal({ isOpen, onClose, onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleQuickLogin = () => {
    onLogin({
      name: 'Dr. Alex Rivera',
      email: 'alex.rivera@seekverse.ai',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() && !name.trim()) {
      handleQuickLogin();
      return;
    }
    const cleanEmail = email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@seekverse.ai`;
    onLogin({
      name: name.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="login-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAF7EE',
          border: '2px solid #2C2C2C',
          borderRadius: '16px',
          boxShadow: '5px 6px 0px 0px #1A2536, 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '28px',
          width: '420px',
          maxWidth: '92vw',
          color: '#1E293B',
          fontFamily: "'Inter', sans-serif",
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', margin: 0, color: '#1E293B' }}>
              🔐 Sign In to SeekVerse
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#475569' }}>
              Access your saved papers, notes, and research history
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              color: '#64748B',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick 1-Click Login */}
        <button
          onClick={handleQuickLogin}
          className="btn-action primary"
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <span>⚡</span> Continue as Demo Researcher
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(44,44,44,0.15)' }} />
          <span style={{ padding: '0 10px' }}>or custom profile</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(44,44,44,0.15)' }} />
        </div>

        {/* Custom Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Marie Curie"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #2C2C2C',
                borderRadius: '8px',
                background: '#FFFFFF',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#334155' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="e.g. marie@research.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #2C2C2C',
                borderRadius: '8px',
                background: '#FFFFFF',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-action success"
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </form>

        <div style={{ marginTop: '16px', padding: '10px', background: '#F1ECE1', borderRadius: '8px', fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
          💡 <strong>Local Mode:</strong> Instant sign-in without external setup. Saved papers and notes are securely persisted in your local SeekVerse SQLite database.
        </div>
      </div>
    </div>
  );
}

function LocalAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('seekverse_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('seekverse_token') || null;
    } catch {
      return null;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const loginWithRedirect = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const loginWithPopup = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleLogin = useCallback((userData) => {
    const cleanEmail = userData.email || 'researcher@seekverse.ai';
    const cleanName = userData.name || cleanEmail.split('@')[0];
    const sub = `local|${cleanEmail.toLowerCase()}`;
    const payload = {
      sub,
      email: cleanEmail,
      name: cleanName,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
    };

    // UTF-8 safe base64 encoding
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    const generatedToken = `local_${b64}`;

    try {
      localStorage.setItem('seekverse_user', JSON.stringify(payload));
      localStorage.setItem('seekverse_token', generatedToken);
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }

    setUser(payload);
    setToken(generatedToken);
    setIsModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('seekverse_user');
      localStorage.removeItem('seekverse_token');
    } catch (e) {
      console.warn('Could not clear localStorage', e);
    }
    setUser(null);
    setToken(null);
  }, []);

  const getAccessTokenSilently = useCallback(async () => {
    if (token) return token;
    const stored = localStorage.getItem('seekverse_token');
    if (stored) return stored;
    return '';
  }, [token]);

  const value = {
    isAuthenticated: Boolean(user && token),
    user,
    isLoading: false,
    loginWithRedirect,
    loginWithPopup,
    logout,
    getAccessTokenSilently,
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
      <LoginModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLogin={handleLogin}
      />
    </UnifiedAuthContext.Provider>
  );
}

function RealAuthAdapter({ children }) {
  const realAuth = useRealAuth0();
  return (
    <UnifiedAuthContext.Provider value={realAuth}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

export function Auth0Provider({ domain, clientId, authorizationParams, children }) {
  if (isRealAuth0(domain)) {
    return (
      <RealAuth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={authorizationParams}
      >
        <RealAuthAdapter>{children}</RealAuthAdapter>
      </RealAuth0Provider>
    );
  }
  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth0() {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useAuth0 must be used within an Auth0Provider');
  }
  return context;
}
