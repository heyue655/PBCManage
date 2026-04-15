import React from 'react';

interface MultilineTextProps {
  text?: string | number | null;
  fallback?: string;
  style?: React.CSSProperties;
}

const MultilineText: React.FC<MultilineTextProps> = ({
  text,
  fallback = '-',
  style,
}) => {
  const value = text === null || text === undefined || text === '' ? fallback : String(text);

  return (
    <span
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {value}
    </span>
  );
};

export default MultilineText;
