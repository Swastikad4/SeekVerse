import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth0 } from '../AuthContext';
import userApi from '../apiClient';

export default function FloatingNotepad({ activePaperId, activePaperTitle }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const debounceRef = useRef(null);

  const loadNotes = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = await getAccessTokenSilently();
    const data = await userApi.get('/user/notes', token);
    setNotes(data || []);
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const createNote = async () => {
    const token = await getAccessTokenSilently();
    const res = await userApi.post('/user/notes', {
      paper_id: activePaperId || null,
      paper_title: activePaperTitle || 'General Note',
      content: '',
      color: '#FFF9C4',
    }, token);
    if (res) {
      setNotes(prev => [res, ...prev]);
      setEditingId(res.id);
      setEditContent('');
    }
  };

  const saveNote = useCallback(async (noteId, content) => {
    const token = await getAccessTokenSilently();
    await userApi.put(`/user/notes/${noteId}`, { content }, token);
  }, [getAccessTokenSilently]);

  const onContentChange = (noteId, value) => {
    setEditContent(value);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: value } : n));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(noteId, value), 800);
  };

  const deleteNote = async (noteId) => {
    const token = await getAccessTokenSilently();
    await userApi.del(`/user/notes/${noteId}`, token);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingId === noteId) setEditingId(null);
  };

  if (!isAuthenticated) return null;

  return (
    <div className={`floating-notepad ${open ? 'expanded' : 'collapsed'}`}>
      <div className="notepad-bar" onClick={() => setOpen(!open)}>
        <span>✏️ My Notes ({notes.length})</span>
        <span>{open ? '▼' : '▲'}</span>
      </div>
      {open && (
        <div className="notepad-body">
          <div className="notepad-list">
            {notes.map(note => (
              <div key={note.id} className="notepad-item" style={{ borderLeft: `4px solid ${note.color || '#FFF9C4'}` }}>
                <div className="notepad-item-header">
                  <span className="notepad-item-title">{note.paper_title || 'General Note'}</span>
                  <button className="notepad-delete" onClick={() => deleteNote(note.id)}>×</button>
                </div>
                {editingId === note.id ? (
                  <textarea
                    className="notepad-textarea"
                    value={editContent}
                    onChange={e => onContentChange(note.id, e.target.value)}
                    autoFocus
                    placeholder="Write your thoughts..."
                  />
                ) : (
                  <p className="notepad-preview" onClick={() => { setEditingId(note.id); setEditContent(note.content || ''); }}>
                    {note.content || 'Click to write...'}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button className="btn-action" style={{ width: '100%', marginTop: '8px' }} onClick={createNote}>
            + NEW NOTE
          </button>
        </div>
      )}
    </div>
  );
}
