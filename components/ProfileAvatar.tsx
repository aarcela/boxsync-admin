'use client';

import { useState, type ReactNode } from 'react';

type ProfileAvatarProps = {
  url?: string | null;
  name?: string | null;
  className?: string;
  fallback?: ReactNode;
};

export default function ProfileAvatar({
  url,
  name,
  className = 'w-full h-full object-cover',
  fallback,
}: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(url) && !failed;

  if (!showImg) {
    return <>{fallback ?? <span>{name?.charAt(0)?.toUpperCase() || 'U'}</span>}</>;
  }

  return (
    <img
      src={url!}
      alt={name || ''}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
