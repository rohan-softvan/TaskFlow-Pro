'use client';

import { useEffect, useState } from 'react';
import { profileApi } from '@/lib/api';

interface AvatarProps {
  fullName?: string | null;
  size?: number;
  /** Bump to force a re-fetch (e.g. right after an upload). */
  version?: number;
}

function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ fullName, size = 40, version = 0 }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    profileApi
      .fetchAvatarBlob()
      .then((blob) => {
        if (!active) return;
        if (blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        } else {
          setUrl(null);
        }
      })
      .catch(() => {
        if (active) setUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version]);

  const dimension = { width: size, height: size };

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt="Avatar"
        style={dimension}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{ ...dimension, fontSize: Math.max(12, size / 2.5) }}
      className="flex items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700"
      aria-label="Avatar placeholder"
    >
      {initials(fullName)}
    </div>
  );
}
