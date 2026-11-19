import React, { useState } from 'react';
import { useAuth0 } from '../AuthContext';

export default function AuthButton({ isSidebarOpen = true }) {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } = useAuth0();
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button
        className="btn-action primary"
        onClick={() => loginWithRedirect()}
        style={{
          marginLeft: isSidebarOpen ? '8px' : '0',
          padding: isSidebarOpen ? '8px 16px' : '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}
      >
        <span>🔐</span>
        {isSidebarOpen && <span>LOGIN</span>}
      </button>
    );
  }

  const handleLogout = () => {
    setShowProfileModal(false);
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Researcher';

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  return (
    <>
      <div className="user-menu" style={{ width: isSidebarOpen ? '100%' : 'auto' }}>
        <button
          className="user-avatar-btn"
          onClick={() => setShowProfileModal(true)}
          title="Click to view Profile & Log Out"
          style={{
            width: isSidebarOpen ? '100%' : 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: isSidebarOpen ? '6px 14px' : '6px',
            background: 'var(--bg-card, #FAF7EE)',
            border: '2px solid var(--border, #2C2C2C)',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '2px 2px 0px var(--border, #2C2C2C)',
            transition: 'all 0.2s',
          }}
        >
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              className="user-avatar-img"
              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--border, #2C2C2C)' }}
            />
          ) : (
            <span
              className="user-avatar-fallback"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#E11D48',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                border: '1.5px solid var(--border, #2C2C2C)',
              }}
            >
              {initials}
            </span>
          )}

          {isSidebarOpen && (
            <div style={{ textAlign: 'left', overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  fontFamily: "'Courier Prime', monospace",
                  color: 'var(--text-primary, #1E293B)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Profile & Logout Modal (Matching original Pen & Paper style) */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)} style={{ zIndex: 1100 }}>
          <div
            className="profile-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FAF7EE',
              border: '2px solid #2C2C2C',
              borderRadius: '16px',
              boxShadow: '6px 7px 0px 0px #1A2536, 0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              padding: '24px',
              width: '400px',
              maxWidth: '92vw',
              color: '#1E293B',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#1A2536',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>👤</span> User Profile
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* User Info Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '14px 16px',
                background: '#FFFFFF',
                border: '1.5px solid #2C2C2C',
                borderRadius: '12px',
                marginBottom: '16px',
              }}
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2px solid #2C2C2C' }}
                />
              ) : (
                <span
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: '#E11D48',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.3rem',
                    border: '2px solid #2C2C2C',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </span>
              )}

              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    fontFamily: "'Courier Prime', monospace",
                    color: '#1E293B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayName}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px', wordBreak: 'break-all', fontFamily: "'Courier Prime', monospace" }}>
                  {user?.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>●</span> Active Session
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div
              style={{
                background: '#F5F0E6',
                border: '1px solid rgba(44, 44, 44, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: '#334155',
              }}
            >
              <div>
                <strong>Account ID:</strong>{' '}
                <code style={{ fontSize: '0.78rem', background: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(44,44,44,0.15)' }}>
                  {user?.sub || 'local|user'}
                </code>
              </div>
              <div style={{ marginTop: '4px' }}>
                <strong>Data Persistence:</strong> Local SQLite (<code>seekverse.db</code>)
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowProfileModal(false)}
                className="btn-action"
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#E2E8F0',
                  color: '#1E293B',
                  border: '2px solid #2C2C2C',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0px #1A2536',
                }}
              >
                CLOSE
              </button>

              <button
                onClick={handleLogout}
                className="btn-action"
                style={{
                  flex: 1.2,
                  padding: '10px',
                  background: '#FEE2E2',
                  color: '#991B1B',
                  border: '2px solid #991B1B',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '2px 2px 0px #1A2536',
                }}
              >
                <span>🚪</span> LOG OUT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
