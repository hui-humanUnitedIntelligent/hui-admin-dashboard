// frontend/src/components/ui/ImageLightbox.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITEKTUR-REGEL: Einzige Lightbox-Komponente für das gesamte Admin-Dashboard.
// Wird von WorksView UND ExperiencesView genutzt — KEINE zweite Version.
// Superadmin und Employee verwenden dieselbe Komponente.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import React, { useEffect, useCallback, useState, useRef } from 'react';

interface ImageLightboxProps {
  images: string[];          // alle Bilder des Eintrags
  initialIndex?: number;     // welches Bild zuerst anzeigen
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

  // Keyboard: ESC + Pfeile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  // Touch-Swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) delta < 0 ? next() : prev();
    touchStartX.current = null;
  };

  if (!images.length) return null;

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {/* Schließen-Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 20,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', width: 40, height: 40, borderRadius: '50%',
          fontSize: 20, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >✕</button>

      {/* Bildnummer */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12,
          padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-body)',
        }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Hauptbild */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '80vh', position: 'relative' }}
      >
        <img
          src={images[idx]}
          alt=""
          style={{
            maxWidth: '90vw', maxHeight: '80vh',
            objectFit: 'contain',
            borderRadius: 8,
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            display: 'block',
          }}
        />
      </div>

      {/* Pfeile (nur bei mehreren Bildern) */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev(); }}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', width: 48, height: 48, borderRadius: '50%',
              fontSize: 22, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >‹</button>
          <button
            onClick={e => { e.stopPropagation(); next(); }}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', width: 48, height: 48, borderRadius: '50%',
              fontSize: 22, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >›</button>
        </>
      )}

      {/* Thumbnail-Strip (bei mehreren Bildern) */}
      {images.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', gap: 6, marginTop: 16,
            overflowX: 'auto', maxWidth: '90vw', paddingBottom: 4,
          }}
        >
          {images.map((url, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                flexShrink: 0, width: 52, height: 52,
                borderRadius: 6, overflow: 'hidden',
                border: i === idx ? '2px solid var(--accent, #6C63FF)' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', opacity: i === idx ? 1 : 0.6,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      {/* Hinweis */}
      <div style={{ position: 'absolute', bottom: 16, color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'var(--font-body)' }}>
        {images.length > 1 ? 'ESC schließen · ← → navigieren · Swipe auf Mobile' : 'ESC oder Klick außen schließen'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClickableImage — Wrapper für anklickbare Bilder mit zoom-in Cursor
// Verwendung: <ClickableImage src={url} onOpenLightbox={() => openLightbox(allImages, i)} />
// ─────────────────────────────────────────────────────────────────────────────
interface ClickableImageProps {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  onOpenLightbox: () => void;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

export function ClickableImage({
  src, alt = '', style = {}, containerStyle = {}, onOpenLightbox, onError,
}: ClickableImageProps) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onOpenLightbox(); }}
      style={{
        cursor: 'zoom-in',
        position: 'relative',
        overflow: 'hidden',
        ...containerStyle,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          transition: 'transform 0.18s ease, opacity 0.15s',
          ...style,
        }}
        onError={onError}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; }}
      />
    </div>
  );
}
