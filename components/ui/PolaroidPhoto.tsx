'use client';

import React from 'react';
import { Camera } from 'lucide-react';
import { TapeCorner } from './TapeCorner';

interface PolaroidPhotoProps {
  src?: string | null;
  caption?: string;
  sublabel?: string;
  rotate?: number;
  grayscale?: boolean;
  className?: string;
}

export function PolaroidPhoto({
  src,
  caption,
  sublabel,
  rotate = -2,
  grayscale = false,
  className = '',
}: PolaroidPhotoProps) {
  return (
    <figure
      style={{ transform: `rotate(${rotate}deg)` }}
      className={`relative inline-block w-full max-w-[230px] border-2 border-[var(--border-ink)] bg-[#FCFBF7] p-2.5 pb-4 text-[#1B1B1B] shadow-[3px_5px_0_var(--shadow-paper)] ${className}`}
    >
      <TapeCorner position="top-center" />
      <div className="relative aspect-[4/4] w-full overflow-hidden border border-[#2C251D]/30 bg-[#E6DEC8]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={caption || 'Classmate portrait'}
            className={`h-full w-full object-cover ${grayscale ? 'grayscale contrast-125' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-[#554C3D]">
            <Camera className="h-8 w-8 opacity-50" />
            <span className="font-mono-doc text-[11px] uppercase tracking-wider">
              Photo Pending
            </span>
          </div>
        )}
      </div>
      {(caption || sublabel) && (
        <figcaption className="mt-2 text-center">
          {caption && (
            <p className="font-hand text-xl font-bold leading-tight text-[#1B1B1B]">
              {caption}
            </p>
          )}
          {sublabel && (
            <p className="font-mono-doc mt-0.5 text-[10px] uppercase tracking-widest text-[#554C3D]">
              {sublabel}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
