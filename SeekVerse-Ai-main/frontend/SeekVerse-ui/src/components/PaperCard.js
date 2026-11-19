import React, { memo } from 'react';

const Accordion = ({ title, content, onRead, speaking }) => {
  const [open, React_useState] = React.useState(false);
  return (
    <div className={`accordion-item ${open ? 'open' : ''}`}>
      <div className="accordion-header" onClick={() => React_useState(!open)}>
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div className="accordion-content">
          <p>{content}</p>
          <button className={`voice-btn ${speaking ? 'active' : ''}`} onClick={onRead}>
            🔊 {speaking ? 'Stop Reading' : 'Read Aloud'}
          </button>
        </div>
      )}
    </div>
  );
};

export const PaperCard = memo(function PaperCard({ 
  paper, isRead, isCompared, isSaved, 
  onToggleRead, onAskAI, onToggleCompare, onFetchRelated, onToggleSave, onNoteClick, 
  speaking, speak, isAuthenticated, relatedPapers 
}) {
  return (
    <div className={`paper-card ${isRead ? 'read' : ''} ${isCompared ? 'compare-selected' : ''}`}>
      <div className="paper-meta">
        <span className={`diff-badge ${paper.difficulty?.level}`}>{paper.difficulty?.level}</span>
        {paper.citation_count > 0 && <span className="meta-text">{paper.citation_count} citations</span>}
        <span className="meta-text">{paper.published}</span>
      </div>
      <h3 className="paper-title">{paper.title}</h3>
      <p className="paper-authors">{paper.authors?.join(', ')}</p>

      <div className="accordion">
        <Accordion title="Simple Explanation (ELI5)" content={paper.eli5 || 'Not available'} onRead={() => speak(paper.eli5)} speaking={speaking} />
        <Accordion title="Technical Summary" content={paper.technical_summary || 'Not available'} onRead={() => speak(paper.technical_summary)} speaking={speaking} />
        <Accordion title="Limitations" content={paper.limitations || 'Not available'} onRead={() => speak(paper.limitations)} speaking={speaking} />
      </div>

      <div className="paper-actions">
        <a href={paper.pdf_url} target="_blank" rel="noreferrer" className="btn-action primary" style={{textDecoration:'none'}}>
          Read Paper
        </a>
        <button className={`btn-action ${isRead ? 'success' : ''}`} onClick={() => onToggleRead(paper.id)}>
          {isRead ? '✓ Read' : 'Mark Read'}
        </button>
        <button className="btn-action ai" onClick={() => onAskAI(paper)}>Ask AI</button>
        <button className={`btn-action ${isCompared ? 'warning' : ''}`} onClick={() => onToggleCompare(paper)}>
          {isCompared ? 'Remove Compare' : 'Compare'}
        </button>
        <button className="btn-action" onClick={() => onFetchRelated(paper)}>Related</button>
        {isAuthenticated && (
          <>
            <button className={`btn-action ${isSaved ? 'success' : ''}`} onClick={() => onToggleSave(paper)}>
              {isSaved ? '📌 Saved' : '📌 Save'}
            </button>
            <button className="btn-action" onClick={() => onNoteClick(paper)}>
              📝 Note
            </button>
          </>
        )}
      </div>

      {relatedPapers && relatedPapers !== 'loading' && (
        <div style={{marginTop:'1.5rem', padding:'1rem', background:'rgba(255,255,255,0.4)', borderRadius:'12px'}}>
          <h4 style={{fontSize:'0.9rem', marginBottom:'10px'}}>Related Papers</h4>
          {relatedPapers.map((rp, j) => (
            <div key={j} style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'8px', fontSize:'0.85rem'}}>
                <span className={`diff-badge ${rp.difficulty?.level}`}>{rp.difficulty?.level}</span>
                <a href={rp.pdf_url} target="_blank" rel="noreferrer" style={{color:'var(--text-primary)'}}>{rp.title}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
