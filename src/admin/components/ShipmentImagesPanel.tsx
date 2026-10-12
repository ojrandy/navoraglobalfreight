import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import { compressImage, ImageCompressError } from '../../services/imageCompress';
import { AdminShipmentImage } from '../../types/shipment';
import { legacyPhotoUrls } from '../../shared/legacyPhotos';
import './ShipmentImagesPanel.css';

// Same limits as server/routes/shipmentImages.ts.
const MAX_IMAGES = 20;
const MAX_CAPTION = 120;

interface PendingImage {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  isPublic: boolean;
  busy: boolean;
  error?: string;
}

interface ShipmentImagesPanelProps {
  trackingNumber: string;
  /** Older photo URLs on the record (photos_json): shown read-only, never edited here. */
  legacyPhotos?: string[];
}

/**
 * Package images for one shipment (docs/update.md B.3). Every change is saved straight away
 * through the images API, independently of any surrounding form's Save button.
 */
export const ShipmentImagesPanel: React.FC<ShipmentImagesPanelProps> = ({ trackingNumber, legacyPhotos }) => {
  const legacy = legacyPhotoUrls(legacyPhotos);
  const [images, setImages] = useState<AdminShipmentImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingImage[]>([]);
  pendingRef.current = pending;
  // Bumped by "Try again" after a failed load (update I.6).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    api.getShipmentImages(trackingNumber)
      .then((list) => { if (!cancelled) { setImages(list); setLoadError(''); } })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load images.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trackingNumber, reloadKey]);

  // Release the local previews when the panel closes.
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const applyList = (list: AdminShipmentImage[], text: string) => {
    setImages(list);
    setCaptionDrafts({});
    setMessage({ text });
  };

  const fail = (err: any, fallback: string) => setMessage({ text: err?.message || fallback, error: true });

  const addFiles = (files: FileList | File[]) => {
    const room = MAX_IMAGES - images.length - pending.length;
    const list = Array.from(files);
    if (room <= 0) {
      setMessage({ text: `A shipment can have up to ${MAX_IMAGES} images.`, error: true });
      return;
    }
    const accepted = list.slice(0, room).map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      isPublic: true,
      busy: false,
    }));
    setPending((prev) => [...prev, ...accepted]);
    setMessage(list.length > room
      ? { text: `Only ${room} more image${room === 1 ? '' : 's'} can be added (limit ${MAX_IMAGES}).`, error: true }
      : { text: `${accepted.length} image${accepted.length === 1 ? '' : 's'} ready. Add a caption to each, then upload.` });
  };

  const updatePending = (key: string, patch: Partial<PendingImage>) =>
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePending = (key: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const uploadOne = async (item: PendingImage) => {
    const caption = item.caption.trim();
    if (!caption) {
      updatePending(item.key, { error: 'A caption is required.' });
      return;
    }
    updatePending(item.key, { busy: true, error: undefined });
    try {
      const compressed = await compressImage(item.file);
      const list = await api.uploadShipmentImage(trackingNumber, {
        base64: compressed.base64,
        caption,
        isPublic: item.isPublic,
        width: compressed.width,
        height: compressed.height,
      });
      removePending(item.key);
      applyList(list, `Uploaded “${caption}”.`);
    } catch (err: any) {
      updatePending(item.key, {
        busy: false,
        error: err instanceof ImageCompressError ? err.message : (err?.message || 'Upload failed. Please try again.'),
      });
    }
  };

  const uploadAll = async () => {
    for (const item of pendingRef.current) {
      if (!item.busy) await uploadOne(item);
    }
  };

  const saveCaption = async (image: AdminShipmentImage) => {
    const draft = captionDrafts[image.id];
    if (draft === undefined) return;
    const caption = draft.trim();
    if (caption === image.caption) {
      setCaptionDrafts(({ [image.id]: _, ...rest }) => rest);
      return;
    }
    if (!caption) {
      setCaptionDrafts(({ [image.id]: _, ...rest }) => rest);
      setMessage({ text: 'A caption is required, so the previous one was kept.', error: true });
      return;
    }
    setBusyId(image.id);
    try {
      applyList(await api.updateShipmentImage(trackingNumber, image.id, { caption }), 'Caption saved.');
    } catch (err) {
      fail(err, 'Could not save the caption.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisibility = async (image: AdminShipmentImage) => {
    setBusyId(image.id);
    try {
      const list = await api.updateShipmentImage(trackingNumber, image.id, { isPublic: !image.isPublic });
      applyList(list, image.isPublic ? `“${image.caption}” is now hidden from the track page.` : `“${image.caption}” is now shown on the track page.`);
    } catch (err) {
      fail(err, 'Could not change visibility.');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const ids = images.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusyId(images[index].id);
    try {
      applyList(await api.reorderShipmentImages(trackingNumber, ids), 'Order saved.');
    } catch (err) {
      fail(err, 'Could not change the order.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (image: AdminShipmentImage) => {
    if (!window.confirm(`Delete the image “${image.caption}”? This cannot be undone.`)) return;
    setBusyId(image.id);
    try {
      applyList(await api.deleteShipmentImage(trackingNumber, image.id), `Deleted “${image.caption}”.`);
    } catch (err) {
      fail(err, 'Could not delete the image.');
    } finally {
      setBusyId(null);
    }
  };

  // This panel sits inside the Edit Shipment form: Enter must never submit that form.
  const stopEnter = (e: React.KeyboardEvent<HTMLInputElement>, action?: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action?.();
    }
  };

  const total = images.length + pending.length;
  const readyCount = pending.filter((p) => !p.busy).length;

  return (
    <section className="ngf-images-panel" aria-labelledby={`ngf-images-${trackingNumber}`}>
      <div className="ngf-images-head">
        <h4 id={`ngf-images-${trackingNumber}`}>Package images</h4>
        <span className="ngf-images-count">{images.length} / {MAX_IMAGES}</span>
      </div>
      <p className="ngf-images-hint">
        Saved as soon as you upload or change them. Visible images appear on the public track page with their caption.
      </p>

      <div
        className={`ngf-images-drop${dragOver ? ' is-over' : ''}${total >= MAX_IMAGES ? ' is-full' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={20} aria-hidden="true" />
        <span>Drag photos here, or</span>
        <button type="button" className="ngf-images-btn" onClick={() => fileInputRef.current?.click()} disabled={total >= MAX_IMAGES}>
          Choose files
        </button>
        <span className="ngf-images-drop-note">JPG, PNG, WebP or HEIC. Resized to 1600px; location data removed.</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {pending.length > 0 && (
        <div className="ngf-images-pending">
          {pending.map((p) => (
            <div className="ngf-images-pending-row" key={p.key}>
              <img src={p.previewUrl} alt="" width={64} height={64} />
              <div className="ngf-images-pending-fields">
                <label className="ngf-images-label" htmlFor={`cap-${p.key}`}>Caption (required)</label>
                <input
                  id={`cap-${p.key}`}
                  type="text"
                  value={p.caption}
                  maxLength={MAX_CAPTION}
                  placeholder="e.g. iPhone 15 – sealed at origin"
                  onChange={(e) => updatePending(p.key, { caption: e.target.value, error: undefined })}
                  onKeyDown={(e) => stopEnter(e, () => uploadOne(p))}
                  disabled={p.busy}
                  aria-invalid={!!p.error}
                />
                <label className="ngf-images-check">
                  <input type="checkbox" checked={p.isPublic} onChange={(e) => updatePending(p.key, { isPublic: e.target.checked })} disabled={p.busy} />
                  <span>Show on the track page</span>
                </label>
                {p.error && <p className="ngf-images-error">{p.error}</p>}
              </div>
              <div className="ngf-images-pending-actions">
                <button type="button" className="ngf-images-btn primary" onClick={() => uploadOne(p)} disabled={p.busy}>
                  {p.busy ? <Loader2 size={14} className="ngf-images-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                  <span>{p.busy ? 'Uploading…' : 'Upload'}</span>
                </button>
                <button type="button" className="ngf-images-icon-btn" onClick={() => removePending(p.key)} disabled={p.busy} aria-label="Remove this file">
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          {readyCount > 1 && (
            <button type="button" className="ngf-images-btn primary ngf-images-upload-all" onClick={uploadAll}>
              <Upload size={14} aria-hidden="true" />
              <span>Upload all ({readyCount})</span>
            </button>
          )}
        </div>
      )}

      <p className={`ngf-images-status${message?.error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {message?.text}
      </p>

      {loading ? (
        <p className="ngf-images-empty">Loading images…</p>
      ) : loadError ? (
        <div className="ngf-load-error" role="alert">
          <p className="ngf-images-error">{loadError}</p>
          <button type="button" className="ngf-load-retry" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : images.length === 0 ? (
        <p className="ngf-images-empty">No images yet.</p>
      ) : (
        <ul className="ngf-images-grid">
          {images.map((image, index) => {
            const busy = busyId === image.id;
            return (
              <li key={image.id} className={`ngf-images-card${image.isPublic ? '' : ' is-hidden'}`}>
                <div className="ngf-images-thumb">
                  <img
                    src={image.adminUrl}
                    alt={image.caption}
                    width={image.width ?? 160}
                    height={image.height ?? 120}
                    loading="lazy"
                  />
                  {!image.isPublic && <span className="ngf-images-badge">Hidden</span>}
                </div>
                <label className="ngf-images-label" htmlFor={`cap-${image.id}`}>Caption</label>
                <input
                  id={`cap-${image.id}`}
                  type="text"
                  value={captionDrafts[image.id] ?? image.caption}
                  maxLength={MAX_CAPTION}
                  onChange={(e) => setCaptionDrafts((d) => ({ ...d, [image.id]: e.target.value }))}
                  onBlur={() => saveCaption(image)}
                  onKeyDown={(e) => stopEnter(e, () => (e.target as HTMLInputElement).blur())}
                  disabled={busy}
                />
                <div className="ngf-images-card-actions">
                  <button type="button" className="ngf-images-icon-btn" onClick={() => toggleVisibility(image)} disabled={busy}
                    aria-label={image.isPublic ? `Hide “${image.caption}” from the track page` : `Show “${image.caption}” on the track page`}
                    title={image.isPublic ? 'Visible on the track page' : 'Hidden from the track page'}>
                    {image.isPublic ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                  </button>
                  <button type="button" className="ngf-images-icon-btn" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move “${image.caption}” earlier`}>
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="ngf-images-icon-btn" onClick={() => move(index, 1)} disabled={busy || index === images.length - 1} aria-label={`Move “${image.caption}” later`}>
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="ngf-images-icon-btn danger" onClick={() => remove(image)} disabled={busy} aria-label={`Delete “${image.caption}”`}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                  {busy && <Loader2 size={14} className="ngf-images-spin" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {legacy.length > 0 && (
        <div className="ngf-images-legacy">
          <h5>Earlier photos (read-only)</h5>
          <p className="ngf-images-hint">Saved on this shipment before captions existed. They also show on the track page.</p>
          <ul className="ngf-images-grid">
            {legacy.map((url, i) => (
              <li key={`${i}-${url.slice(0, 80)}`} className="ngf-images-card">
                <div className="ngf-images-thumb">
                  <img src={url} alt={`Shipment photo ${i + 1}`} width={160} height={120} loading="lazy" />
                </div>
                <p className="ngf-images-legacy-label">Shipment photo {i + 1}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
