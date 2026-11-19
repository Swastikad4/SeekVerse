import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import 'regenerator-runtime/runtime';
import { useAuth0 } from './AuthContext';
import userApi from './apiClient';
import AuthButton from './components/AuthButton';
import SavedPapersTab from './components/SavedPapersTab';
import HistoryTab from './components/HistoryTab';
import FloatingNotepad from './components/FloatingNotepad';
import { SearchBar } from './components/SearchBar';
import { PaperCard } from './components/PaperCard';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8001';

export default function App() {
  const [lastQuery, setLastQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [readPapers, setReadPapers] = useState(() => JSON.parse(localStorage.getItem('readPapers') || '[]'));
  const [chatPaper, setChatPaper] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [comparePapers, setComparePapers] = useState([]);
  const [compareResult, setCompareResult] = useState(null);
  
  // Removed unused quiz variables
  
  const [relatedMap, setRelatedMap] = useState({});
  const [activeTab, setActiveTab] = useState('search');
  const [speaking, setSpeaking] = useState(false);
  const [sortBy, setSortBy] = useState('relevant');
  const [savedPaperIds, setSavedPaperIds] = useState([]);
  const [notePaper, setNotePaper] = useState({ id: null, title: null });
  const [recentHistory, setRecentHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => { localStorage.setItem('readPapers', JSON.stringify(readPapers)); }, [readPapers]);

  // Load saved paper IDs and recent history on login
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const token = await getAccessTokenSilently();
      const [savedData, historyData] = await Promise.all([
        userApi.get('/user/saved-papers', token),
        userApi.get('/user/history', token)
      ]);
      if (savedData) setSavedPaperIds(savedData.map(p => p.paper_id));
      if (historyData) setRecentHistory(historyData.slice(0, 3));
    })();
  }, [isAuthenticated, getAccessTokenSilently]);

  // Fire-and-forget helpers
  const logSearch = useCallback(async (q, count) => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessTokenSilently();
      userApi.post('/user/searches', { query: q, results_count: count }, token);
    } catch {}
  }, [isAuthenticated, getAccessTokenSilently]);

  const logPaperView = useCallback(async (paper) => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessTokenSilently();
      userApi.post('/user/history', {
        paper_id: paper.id, title: paper.title,
        pdf_url: paper.pdf_url, difficulty_level: paper.difficulty?.level || ''
      }, token);
    } catch {}
  }, [isAuthenticated, getAccessTokenSilently]);

  const toggleSave = useCallback(async (paper) => {
    if (!isAuthenticated) return;
    const token = await getAccessTokenSilently();
    if (savedPaperIds.includes(paper.id)) {
      await userApi.del(`/user/saved-papers/${paper.id}`, token);
      setSavedPaperIds(prev => prev.filter(id => id !== paper.id));
    } else {
      await userApi.post('/user/saved-papers', {
        paper_id: paper.id, title: paper.title,
        authors: paper.authors, abstract: paper.abstract,
        pdf_url: paper.pdf_url, published: paper.published,
        citation_count: paper.citation_count,
        difficulty_level: paper.difficulty?.level || '',
        eli5: paper.eli5 || '', technical_summary: paper.technical_summary || ''
      }, token);
      setSavedPaperIds(prev => [...prev, paper.id]);
    }
  }, [isAuthenticated, getAccessTokenSilently, savedPaperIds]);

  const search = useCallback(async (q) => {
    if (!q || !q.trim()) return;
    setLastQuery(q);
    setLoading(true); setError(''); setResults(null); setOffset(0);
    try {
      const res = await axios.post(`${API}/search`, { query: q, offset: 0 });
      setResults(res.data);
      setOffset(5);
      logSearch(q, res.data?.papers?.length || 0);
    } catch { setError('Search failed. Make sure backend is running.'); }
    setLoading(false);
  }, [logSearch]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await axios.post(`${API}/search`, { query: lastQuery, offset });
      setResults(prev => ({ ...prev, papers: [...prev.papers, ...res.data.papers] }));
      setOffset(o => o + 5);
    } catch { setError('Could not load more papers.'); }
    setLoadingMore(false);
  }, [lastQuery, offset]);

  const analyzeUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await axios.post(`${API}/analyze-url`, { url: urlInput });
      if (res.data.error) { setError(res.data.error); }
      else {
        setResults({
          papers: [res.data.paper],
          learning_path: { steps: res.data.learning_path },
          research_gaps: res.data.research_gaps || [],
          related_from_url: res.data.related || [],
          url_mode: true
        });
      }
    } catch { setError('Could not analyze URL.'); }
    setLoading(false);
  };

  const speak = useCallback((text) => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, [speaking]);

  const toggleRead = useCallback((id) => setReadPapers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);

  const toggleCompare = useCallback((paper) => {
    setComparePapers(prev => {
      let updated;
      if (prev.find(p => p.id === paper.id)) {
        updated = prev.filter(p => p.id !== paper.id);
      } else if (prev.length >= 2) {
        updated = [prev[1], paper];
      } else {
        updated = [...prev, paper];
      }
      if (updated.length === 2) setActiveTab('compare');
      return updated;
    });
  }, []);

  const runCompare = async () => {
    if (comparePapers.length < 2) return;
    setCompareResult('loading');
    try {
      const res = await axios.post(`${API}/compare`, {
        paper1_title: comparePapers[0].title,
        paper1_abstract: comparePapers[0].abstract,
        paper2_title: comparePapers[1].title,
        paper2_abstract: comparePapers[1].abstract
      });
      setCompareResult(res.data.comparison);
    } catch { setCompareResult('Failed to compare.'); }
  };

  const fetchRelated = useCallback(async (paper) => {
    setRelatedMap(prev => ({ ...prev, [paper.id]: 'loading' }));
    try {
      const res = await axios.post(`${API}/related`, { paper_title: paper.title, paper_abstract: paper.abstract || ''});
      setRelatedMap(prev => ({ ...prev, [paper.id]: res.data.related }));
    } catch(e) { console.log(e); }
  }, []);

  const handleAskAI = useCallback((paper) => {
    setChatPaper(paper);
  }, []);

  const handleNoteClick = useCallback((paper) => {
    setNotePaper({ id: paper.id, title: paper.title });
  }, []);

  const readCount = results?.papers?.filter(p => readPapers.includes(p.id))?.length || 0;
  const totalPapers = results?.papers?.length || 0;
  const sortedPapers = results?.papers ? [...results.papers].sort((a, b) => {
    if (sortBy === 'newest') return parseInt(b.published) - parseInt(a.published);
    if (sortBy === 'oldest') return parseInt(a.published) - parseInt(b.published);
    return 0;
  }) : [];

  const avgCitations = totalPapers > 0 ? Math.round(results.papers.reduce((sum, p) => sum + (p.citation_count || 0), 0) / totalPapers) : 0;

  return (
    <div className="app">
      <div className="bg-orb-1" />
      <div className="bg-orb-2" />
      <div className="bg-orb-3" />

      <div className="app-layout">
        <aside className={`sidebar-nav ${isSidebarOpen ? 'open' : 'closed'}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <div className="sidebar-top">
            <div className="logo">
              <div className="logo-icon">S</div>
              {isSidebarOpen && (
                <div className="logo-text">
                  <h1>SeekVerse</h1>
                  <p>Find & Master</p>
                </div>
              )}
            </div>
          </div>
          <nav className="nav">
            <button className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); setActiveTab('search'); }}>
              <span className="icon">🔍</span>
              {isSidebarOpen && <span>Search</span>}
            </button>
            <button className={`nav-btn ${activeTab === 'url' ? 'active' : ''}`} onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); setActiveTab('url'); }}>
              <span className="icon">🔗</span>
              {isSidebarOpen && <span>Analyze URL</span>}
            </button>
            {comparePapers.length > 0 && (
              <button className="nav-btn compare-badge" onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); setActiveTab('compare'); }}>
                <span className="icon">⚖️</span>
                {isSidebarOpen && <span>Compare ({comparePapers.length}/2)</span>}
              </button>
            )}
            {isAuthenticated && (
              <>
                <button className={`nav-btn ${activeTab === 'saved' ? 'active' : ''}`} onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); setActiveTab('saved'); }}>
                  <span className="icon">📌</span>
                  {isSidebarOpen && <span>Saved</span>}
                </button>
                <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); setActiveTab('history'); }}>
                  <span className="icon">🕒</span>
                  {isSidebarOpen && <span>History</span>}
                </button>
              </>
            )}
          </nav>
          <div className="sidebar-bottom" onClick={(e) => { if(isSidebarOpen) e.stopPropagation(); }}>
            <AuthButton isSidebarOpen={isSidebarOpen} />
          </div>
        </aside>

        <main className="main-scroll-area">

      {/* HERO SECTION - Only show if no results and no loading */}
      {!results && !loading && activeTab === 'search' && (
        <div className="hero">
          <h2>Discover Research, Intelligently.</h2>
          <p>Multi-agent AI finds, classifies, and explains papers for you.</p>
          
          <SearchBar onSearch={search} />
          
          {error && <div className="error-msg">{error}</div>}

          {/* Desk Grid (Bottom half of Hero) */}
          <div className="desk-grid">
             {/* 2. Recent Workspace Cards */}
             <div className="desk-tray recent-workspace">
               <h3 className="tray-title">🕒 Recent Workspace</h3>
               {recentHistory.length === 0 ? (
                 <div className="recent-placeholder">
                   <p>Your recent research papers will automatically pin here!</p>
                 </div>
               ) : (
                 <div className="recent-cards-list">
                   {recentHistory.map((h, i) => (
                     <div key={i} className="recent-mini-card" onClick={() => window.open(h.pdf_url, '_blank')}>
                       <p className="recent-title">{h.title || 'Untitled'}</p>
                       <p className="recent-time">{new Date(h.last_visited).toLocaleDateString()}</p>
                     </div>
                   ))}
                 </div>
               )}
             </div>
             
             {/* 3. Desk Assistant Highlight */}
             <div className="desk-tray desk-assistant">
                <div className="washi-tape"></div>
                <h3 className="tray-title">💡 Pro Tip</h3>
                <p className="tip-text">"Use <b>'Analyze URL'</b> to break down any arXiv or Semantic Scholar paper link in seconds!"</p>
             </div>
          </div>
        </div>
      )}

      {!results && !loading && activeTab === 'url' && (
        <div className="hero">
          <h2>Analyze Any Paper.</h2>
          <p>Paste an ArXiv, Springer, or IEEE URL to generate insights.</p>
          <div className="search-box-large">
            <input 
              value={urlInput} 
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && analyzeUrl()}
              placeholder="Paste paper URL here..."
            />
            <button className="btn-search-large" onClick={analyzeUrl}>Analyze</button>
          </div>
          {error && <div className="error-msg">{error}</div>}
        </div>
      )}

      {loading && (
        <div className="loading-box">
          <div className="spinner" />
          <h3 style={{color:'var(--text-primary)'}}>Agents working...</h3>
          <p style={{color:'var(--text-secondary)'}}>Fetching papers, analyzing difficulty, generating explanations.</p>
        </div>
      )}

      {/* RESULTS VIEW */}
      {results && !loading && activeTab !== 'compare' && (
        <>
          {/* STATS ROW */}
          <div className="stats-row">
            <div className="stat-card stat-sticky-note">
              <div className="sticky-pin"></div>
              <span className="stat-label">Papers Found</span>
              <span className="stat-value">{totalPapers}</span>
              <span className="stat-sub">From ArXiv & Semantic Scholar</span>
            </div>
            <div className="stat-card stat-index-card">
              <span className="stat-label">Avg Citations</span>
              <span className="stat-value stamp-effect">{avgCitations}</span>
              <span className="stat-sub">Across all results</span>
            </div>
            <div className="stat-card stat-progress-ring-card">
              <span className="stat-label">Read Progress</span>
              <div className="progress-ring-container">
                <svg className="progress-ring" viewBox="0 0 36 36">
                  <path className="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="ring-fill" strokeDasharray={`${Math.round((readCount/totalPapers)*100 || 0)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <text x="18" y="20.35" className="ring-text">{Math.round((readCount/totalPapers)*100 || 0)}%</text>
                </svg>
              </div>
              <span className="stat-sub">{readCount} / {totalPapers} Completed</span>
            </div>
            <div className="stat-card stat-torn-note">
              <span className="stat-label">Research Gaps</span>
              <span className="stat-value">{results.research_gaps?.length || 0}</span>
              <span className="stat-sub">Unexplored areas identified</span>
            </div>
          </div>

          <div className="main-content">
            {/* PAPERS COLUMN */}
            <div className="papers-stream">
              <div className="stream-header">
                <h2>Papers</h2>
                <div style={{display:'flex', gap:'8px'}}>
                  {['relevant', 'newest', 'oldest'].map(s => (
                    <button key={s} className={`btn-action ${sortBy === s ? 'primary' : ''}`} onClick={() => setSortBy(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {sortedPapers.map((paper, i) => {
                // Log paper view on render (fire-and-forget)
                if (isAuthenticated && paper.id) logPaperView(paper);
                return (
                  <PaperCard 
                    key={paper.id || i}
                    paper={paper}
                    isRead={readPapers.includes(paper.id)}
                    isCompared={comparePapers.find(p => p.id === paper.id)}
                    isSaved={savedPaperIds.includes(paper.id)}
                    onToggleRead={toggleRead}
                    onAskAI={handleAskAI}
                    onToggleCompare={toggleCompare}
                    onFetchRelated={fetchRelated}
                    onToggleSave={toggleSave}
                    onNoteClick={handleNoteClick}
                    speaking={speaking}
                    speak={speak}
                    isAuthenticated={isAuthenticated}
                    relatedPapers={relatedMap[paper.id]}
                  />
                );
              })}
              {results.papers?.length >= 3 && !results.url_mode && (
                <button className="btn-search-large" style={{width:'100%', margin:'1rem 0'}} onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load More Papers'}
                </button>
              )}
            </div>

            {/* SIDEBAR COLUMN */}
            <div className="sidebar">
              <div className="side-card">
                <h3>📚 Learning Path</h3>
                <div className="stepper">
                  {results.learning_path?.steps?.split('\n').filter(Boolean).map((step, i) => (
                    <div key={i} className="step-item">
                      <div className="step-num">{i + 1}</div>
                      <div className="step-content">
                        {step.replace(/^Step \d+:/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="side-card">
                <h3>🔬 Research Gaps</h3>
                {results.research_gaps?.length > 0 ? (
                  results.research_gaps.map((gap, i) => (
                    <div key={i} className="gap-item">
                      {gap.replace(/\*\*/g, '').replace(/\*/g, '')}
                    </div>
                  ))
                ) : <p style={{color:'var(--text-secondary)', fontSize:'0.9rem'}}>No gaps identified.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* COMPARE TAB VIEW */}
      {activeTab === 'compare' && (
         <div className="main-content" style={{display:'block'}}>
            <h2 style={{marginBottom:'2rem', textAlign:'center'}}>Paper Comparison</h2>
            {comparePapers.length < 2 && <p style={{textAlign:'center', color:'var(--text-secondary)'}}>Select 2 papers from search results to compare.</p>}
            {comparePapers.length === 2 && (
              <div style={{maxWidth:'1000px', margin:'0 auto'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'20px', alignItems:'center'}}>
                  <div className="side-card"><strong>{comparePapers[0].title}</strong></div>
                  <div style={{background:'var(--amber)', color:'white', padding:'12px', borderRadius:'50%', fontWeight:'bold'}}>VS</div>
                  <div className="side-card"><strong>{comparePapers[1].title}</strong></div>
                </div>
                <div style={{textAlign:'center', marginTop:'2rem'}}>
                  <button className="btn-search-large" onClick={runCompare}>Analyze Comparison</button>
                </div>
                {compareResult === 'loading' && <div className="loading-box"><div className="spinner"/></div>}
                {compareResult && compareResult !== 'loading' && (
                  <div className="side-card" style={{marginTop:'2rem'}}>
                    {compareResult.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} style={{marginBottom:'10px', fontWeight: line.includes(':') && line.split(':')[0].length < 20 ? '600' : '400'}}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
         </div>
      )}

      {/* SAVED PAPERS TAB */}
      {activeTab === 'saved' && <SavedPapersTab />}

      {/* HISTORY TAB */}
      {activeTab === 'history' && <HistoryTab />}

      {/* CHAT MODAL */}
      {chatPaper && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Ask about: {chatPaper.title}</h3>
            <button className="chat-close" onClick={() => { setChatPaper(null); setChatHistory([]); }}>&times;</button>
          </div>
          <div className="chat-body">
            {chatHistory.length === 0 && <p style={{color:'var(--text-secondary)', textAlign:'center', marginTop:'40px'}}>Ask anything about this paper.</p>}
            {chatHistory.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>)}
          </div>
          <div className="chat-footer">
             <input 
                value={chatMsg} 
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && chatMsg.trim()) {
                    const q = chatMsg; setChatMsg('');
                    setChatHistory(h => [...h, { role: 'user', text: q }]);
                    try {
                      const res = await axios.post(`${API}/chat`, { question: q, paper_title: chatPaper.title, paper_abstract: chatPaper.abstract });
                      setChatHistory(h => [...h, { role: 'ai', text: res.data.answer }]);
                    } catch { setChatHistory(h => [...h, { role: 'ai', text: 'Error. Try again.' }]); }
                  }
                }}
                placeholder="Ask a question..." 
             />
             <button onClick={async () => {
                if (!chatMsg.trim()) return;
                const q = chatMsg; setChatMsg('');
                setChatHistory(h => [...h, { role: 'user', text: q }]);
                try {
                  const res = await axios.post(`${API}/chat`, { question: q, paper_title: chatPaper.title, paper_abstract: chatPaper.abstract });
                  setChatHistory(h => [...h, { role: 'ai', text: res.data.answer }]);
                } catch { setChatHistory(h => [...h, { role: 'ai', text: 'Error. Try again.' }]); }
             }}>Send</button>
          </div>
        </div>
      )}

        </main>
      </div>

      {/* FLOATING NOTEPAD */}
      <FloatingNotepad activePaperId={notePaper.id} activePaperTitle={notePaper.title} />
    </div>
  );
}