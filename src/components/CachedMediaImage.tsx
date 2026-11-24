import React, { useState, useEffect, useMemo } from 'react';
import { ImageIcon } from 'lucide-react';
import { getCachedMediaUrl } from '../utils/mediaCache';
import { normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

interface CachedMediaImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: React.ReactNode;
}

export const CachedMediaImage: React.FC<CachedMediaImageProps> = ({
  src,
  alt = '',
  className = '',
  fallbackIcon,
  ...props
}) => {
  const normalizedSrc = useMemo(() => normalizeProTalkMediaUrl(src || '') || (src || ''), [src]);
  const proxySrc = useMemo(
    () => (normalizedSrc.startsWith('http') ? `/api/media-proxy?url=${encodeURIComponent(normalizedSrc)}` : normalizedSrc),
    [normalizedSrc]
  );

  const [cachedSrc, setCachedSrc] = useState<string>(normalizedSrc);
  const [fallbackStage, setFallbackStage] = useState<0 | 1 | 2>(0);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setFallbackStage(0);

    if (!normalizedSrc) {
      setCachedSrc('');
      setIsLoaded(false);
      return;
    }

    if (normalizedSrc.startsWith('data:') || normalizedSrc.startsWith('blob:')) {
      setCachedSrc(normalizedSrc);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    setCachedSrc(proxySrc);

    getCachedMediaUrl(normalizedSrc)
      .then((resolvedUrl) => {
        if (isMounted && resolvedUrl) {
          setCachedSrc(resolvedUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCachedSrc(proxySrc);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [normalizedSrc, proxySrc]);

  if (hasError || !normalizedSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-sky-100/70 via-pink-100/70 to-orange-100/70 text-pink-600 border border-pink-200/80 ${className}`}
      >
        {fallbackIcon || <ImageIcon size={20} />}
      </div>
    );
  }

  return (
    <img
      src={cachedSrc || proxySrc}
      alt={alt}
      className={`${className} ${!isLoaded ? 'opacity-90' : 'opacity-100'} transition-opacity duration-200`}
      onLoad={() => setIsLoaded(true)}
      onError={() => {
        if (fallbackStage === 0 && cachedSrc !== proxySrc && proxySrc) {
          setFallbackStage(1);
          setCachedSrc(proxySrc);
        } else if (fallbackStage < 2 && cachedSrc !== normalizedSrc) {
          setFallbackStage(2);
          setCachedSrc(normalizedSrc);
        } else {
          setHasError(true);
        }
      }}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};
