import React, { lazy, Suspense, useRef, useState } from 'react';
import './PackageGallery.css';

// The full-screen viewer is only downloaded when a photo is opened.
const PackageImageViewer = lazy(() => import('./PackageImageViewer').then((m) => ({ default: m.PackageImageViewer })));

export interface GalleryImage {
  url: string;
  /** Shown under the photo and used as its alt text. */
  caption: string;
  width: number | null;
  height: number | null;
}

interface PackageGalleryProps {
  images: GalleryImage[];
}

// Used when a photo's size isn't known, so the layout still reserves space (4:3).
const FALLBACK_WIDTH = 1600;
const FALLBACK_HEIGHT = 1200;

/** Track Result "Package images" section (CONTENT.md §6.6). Renders nothing without photos. */
export const PackageGallery: React.FC<PackageGalleryProps> = ({ images }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  if (images.length === 0) return null;

  const close = () => {
    setOpenIndex(null);
    // Return focus to the thumbnail that opened the viewer.
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  return (
    <section className="ngf-gallery-section" aria-labelledby="track-gallery-title">
      <h3 id="track-gallery-title" className="card-section-title">Package images</h3>
      <p className="ngf-gallery-intro">Photos our team has added for this shipment.</p>
      {/* data-count sets the columns from tablet width up: 1 photo full width, 2 halves, 3+ thirds. */}
      <ul className="ngf-gallery-grid" data-count={Math.min(images.length, 3)}>
        {images.map((image, index) => (
          <li key={`${index}-${image.url.slice(0, 80)}`}>
            <figure className="ngf-gallery-item">
              <button
                type="button"
                className="ngf-gallery-thumb"
                aria-label={`Open photo: ${image.caption}`}
                onClick={(e) => {
                  openerRef.current = e.currentTarget;
                  setOpenIndex(index);
                }}
              >
                <img
                  src={image.url}
                  alt={image.caption}
                  width={image.width ?? FALLBACK_WIDTH}
                  height={image.height ?? FALLBACK_HEIGHT}
                  loading="lazy"
                  decoding="async"
                />
              </button>
              <figcaption>{image.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <Suspense fallback={null}>
          <PackageImageViewer images={images} index={openIndex} onIndexChange={setOpenIndex} onClose={close} />
        </Suspense>
      )}
    </section>
  );
};
