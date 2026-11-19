import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export function SearchBar({ onSearch }) {
  const [localQuery, setLocalQuery] = useState('');
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setLocalQuery(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(localQuery);
  };

  const toggleListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening();
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="search-box-large">
        {browserSupportsSpeechRecognition && (
          <button type="button" className={`voice-btn ${listening ? 'active' : ''}`} onClick={toggleListening}>
            🎤
          </button>
        )}
        <input 
          value={localQuery} 
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search any research topic (e.g. quantum computing)..."
        />
        <button type="submit" className="btn-search-large">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'text-bottom'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          SEARCH
        </button>
      </form>
      {listening && <p style={{marginTop:'1rem', color:'var(--rose)'}}>Listening...</p>}
    </>
  );
}
