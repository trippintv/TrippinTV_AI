import React from 'react';

interface RichTextProps {
  text: string;
  onOpenUsername?: (username: string) => void;
  onSelectTopic?: (tag: string) => void;
  className?: string;
}

// Renders @mentions and #hashtags as tappable, styled tokens.
const RichText: React.FC<RichTextProps> = ({ text, onOpenUsername, onSelectTopic, className }) => {
  const parts = text.split(/(@[A-Za-z0-9_]+|#[A-Za-z0-9_]+)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && onOpenUsername) {
          return (
            <button
              key={i}
              type="button"
              className="font-semibold text-purple-400 hover:underline"
              onClick={() => onOpenUsername(part.slice(1))}
            >
              {part}
            </button>
          );
        }
        if (part.startsWith('#') && onSelectTopic) {
          return (
            <button
              key={i}
              type="button"
              className="font-semibold text-cyan-400 hover:underline"
              onClick={() => onSelectTopic(part.slice(1))}
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default RichText;
