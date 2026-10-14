import React, { useEffect, useState } from 'react';

/**
 * Drop-in <img> that retries once if loading fails (e.g. a flaky connection or a
 * stale cached 404), then shows a tidy placeholder instead of the browser's broken-image icon.
 */
export const SafeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
  src,
  alt,
  className,
  onError,
  ...rest
}) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className ?? ''} flex items-center justify-center bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider text-center p-2`}
      >
        {alt || 'Image unavailable'}
      </div>
    );
  }

  const url = attempt > 0 && src ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src;

  return (
    <img
      {...rest}
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        onError?.(e);
        if (attempt < 1) setAttempt(attempt + 1);
        else setFailed(true);
      }}
    />
  );
};
