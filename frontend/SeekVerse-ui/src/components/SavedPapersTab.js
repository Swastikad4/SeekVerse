import React, { useEffect, useState } from 'react';
import { useAuth0 } from '../AuthContext';
import userApi from '../apiClient';

export default function SavedPapersTab() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const token = await getAccessTokenSilently();
      const data = await userApi.get('/user/saved-papers', token);
      setPapers(data || []);
      setLoading(false);
    })();
  }, [isAuthenticated, getAccessTokenSilently]);

  const unsave = async (paperId) => {
    const token = await getAccessTokenSilently();
    await userApi.del(`/user/saved-papers/${paperId}`, token);
    setPapers(prev => prev.filter(p => p.paper_id !== paperId));
  };

  if (!isAuthenticated) {
    return <div className="hero"><h2>Login to see saved papers</h2></div>;
  }
  if (loading) {
    return <div className="loading-box"><div className="spinner" /><p>Loading saved papers...</p></div>;
  }

  return (
    <div className="main-content" style={{ display: 'block', maxWidth: '900px', margin: '2rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Kalam', cursive" }}>📌 Saved Papers ({papers.length})</h2>
      {papers.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No saved papers yet. Click 📌 Save on any paper to bookmark it.</p>}
      {papers.map((p, i) => (
        <div key={i} className="paper-card" style={{ transform: `rotate(${i % 2 === 0 ? '-0.3' : '0.4'}deg)` }}>
          <div className="paper-meta">
            {p.difficulty_level && <span className={`diff-badge ${p.difficulty_level}`}>{p.difficulty_level}</span>}
            {p.published && <span className="meta-text">{p.published}</span>}
          </div>
          <h3 className="paper-title">{p.title}</h3>
          {p.authors_csv && <p className="paper-authors">{p.authors_csv}</p>}
          {p.eli5 && <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{p.eli5}</p>}
          <div className="paper-actions">
            {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noreferrer" className="btn-action primary" style={{ textDecoration: 'none' }}>Read Paper</a>}
            <button className="btn-action warning" onClick={() => unsave(p.paper_id)}>📌 Unsave</button>
          </div>
        </div>
      ))}
    </div>
  );
}
