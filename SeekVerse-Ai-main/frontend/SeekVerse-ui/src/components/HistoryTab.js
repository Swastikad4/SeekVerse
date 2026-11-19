import React, { useEffect, useState } from 'react';
import { useAuth0 } from '../AuthContext';
import userApi from '../apiClient';

export default function HistoryTab() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [searches, setSearches] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const token = await getAccessTokenSilently();
      const [s, h] = await Promise.all([
        userApi.get('/user/searches', token),
        userApi.get('/user/history', token),
      ]);
      setSearches(s || []);
      setHistory(h || []);
      setLoading(false);
    })();
  }, [isAuthenticated, getAccessTokenSilently]);

  if (!isAuthenticated) {
    return <div className="hero"><h2>Login to see your history</h2></div>;
  }
  if (loading) {
    return <div className="loading-box"><div className="spinner" /><p>Loading history...</p></div>;
  }

  return (
    <div className="main-content" style={{ display: 'block', maxWidth: '900px', margin: '2rem auto' }}>
      {/* Recent Searches */}
      <div className="side-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: "'Kalam', cursive" }}>🔍 Recent Searches</h3>
        {searches.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No searches yet.</p>}
        {searches.map((s, i) => (
          <div key={i} className="history-item">
            <span className="history-query">"{s.query}"</span>
            <span className="meta-text">{s.results_count} results • {new Date(s.searched_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>

      {/* Papers Viewed */}
      <div className="side-card">
        <h3 style={{ fontFamily: "'Kalam', cursive" }}>📖 Papers Viewed</h3>
        {history.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No papers viewed yet.</p>}
        {history.map((h, i) => (
          <div key={i} className="history-item">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {h.difficulty_level && <span className={`diff-badge ${h.difficulty_level}`}>{h.difficulty_level}</span>}
              <a href={h.pdf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {h.title || 'Untitled'}
              </a>
            </div>
            <span className="meta-text">Last viewed: {new Date(h.last_visited).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
