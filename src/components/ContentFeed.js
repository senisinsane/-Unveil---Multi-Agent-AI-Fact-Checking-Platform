'use client';

import { samplePosts } from '@/lib/samplePosts';
import { useState } from 'react';

function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function ContentFeed({ onAnalyze, isAnalyzing, analyzedPosts }) {
  const [activePostId, setActivePostId] = useState(null);
  const [customText, setCustomText] = useState('');

  const handlePostClick = (post) => {
    if (isAnalyzing) return;
    setActivePostId(post.id);
    onAnalyze(post.text, post.id);
  };

  const handleCustomSubmit = () => {
    if (isAnalyzing || !customText.trim()) return;
    setActivePostId(null);
    onAnalyze(customText.trim());
  };

  return (
    <div className="panel" id="content-feed">
      <div className="panel__header">
        <span className="panel__title">
          <span className="panel__title-icon">📰</span>
          Content Feed
        </span>
        <span className="panel__badge">{samplePosts.length}</span>
      </div>

      {/* Custom Input */}
      <div className="custom-input glass">
        <textarea
          className="custom-input__textarea"
          placeholder="Paste any social media post or article text here to analyze..."
          rows={3}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
        />
        <button
          className="custom-input__btn"
          onClick={handleCustomSubmit}
          disabled={isAnalyzing || !customText.trim()}
        >
          ⚡ Analyze Custom Content
        </button>
      </div>

      <div className="panel__scroll" id="feed-scroll">
        {samplePosts.map((post) => {
          const verdict = analyzedPosts[post.id];
          return (
            <div
              key={post.id}
              className={`feed-card glass ${activePostId === post.id ? 'active' : ''} ${verdict ? 'analyzed' : ''}`}
              onClick={() => handlePostClick(post)}
            >
              <div className="feed-card__header">
                <span className="feed-card__avatar">{post.avatar}</span>
                <span className="feed-card__author">{post.author}</span>
                <span className="feed-card__platform">{post.platform}</span>
              </div>
              <div className="feed-card__text">{post.text}</div>
              <div className="feed-card__meta">
                <span>❤️ {formatNumber(post.likes)}</span>
                <span>🔄 {formatNumber(post.shares)}</span>
                <span>{post.timestamp}</span>
              </div>
              {verdict && (
                <div className={`feed-card__verdict-badge label--${verdict}`}>
                  {verdict.toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
