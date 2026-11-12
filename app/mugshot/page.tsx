'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  RefreshCw,
  Upload,
  VideoOff,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getRosterById } from '@/data/roster';
import { stripExifAndMeasure } from '@/lib/imageUtils';
import { uploadImageToSupabase, flushSyncQueue } from '@/lib/sync';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';
import { generateUuid } from '@/lib/crypto';
import { PolaroidPhoto } from '@/components/ui/PolaroidPhoto';

type PortraitSlotKind = 'portrait' | 'mugshot' | 'worst_face';

interface SlotMeta {
  kind: PortraitSlotKind;
  title: string;
  subtitle: string;
  badge: string;
  supportsGrayscale?: boolean;
  supportsCamera?: boolean;
}

const SLOTS: readonly SlotMeta[] = [
  {
    kind: 'portrait',
    title: '1. Official Portrait',
    subtitle:
      'Upload a clean, plain-background, high-resolution photo from your gallery. Used for your Stat Card, NCERT Chapter, and Dossier.',
    badge: 'GALLERY ONLY • REQUIRED',
  },
  {
    kind: 'mugshot',
    title: '2. CID Mugshot',
    subtitle:
      'Upload a deadpan front-facing mugshot from your gallery. Toggle high-contrast B&W CID filter below before uploading.',
    badge: 'GALLERY ONLY • CID',
    supportsGrayscale: true,
  },
  {
    kind: 'worst_face',
    title: '3. "Worst Face You Can Make"',
    subtitle:
      'Maximum chaos expression. Use the live camera booth below or upload straight from your gallery.',
    badge: 'CAMERA OR GALLERY',
    supportsCamera: true,
  },
];

export default function MugshotStationPage() {
  const router = useRouter();
  const contributor = useAppStore((s) => s.contributor);
  const updateContributorFields = useAppStore((s) => s.updateContributorFields);
  const uploads = useAppStore((s) => s.uploads);
  const upsertUpload = useAppStore((s) => s.upsertUpload);
  const awardXp = useAppStore((s) => s.awardXp);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mugshotGrayscale, setMugshotGrayscale] = useState(true);
  const [processingSlot, setProcessingSlot] = useState<PortraitSlotKind | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraBoothRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not supported on this browser. Use gallery upload below!');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraError(
        'Camera permission was denied or unavailable. No problem—use the gallery upload buttons below!'
      );
      setCameraActive(false);
    }
  };

  const handleImageBlob = async (blob: Blob, slot: PortraitSlotKind) => {
    setProcessingSlot(slot);
    setFormError(null);
    try {
      const applyFilter = slot === 'mugshot' && mugshotGrayscale;
      const processed = await stripExifAndMeasure(blob, {
        grayscaleContrast: applyFilter,
      });

      const id = generateUuid();
      const filename = `${slot}-${id}.${processed.ext}`;
      const { storagePath, uploaded, error } = await uploadImageToSupabase({
        blob: processed.file,
        folder: 'portraits',
        filename,
        mimeType: processed.mimeType,
      });

      upsertUpload({
        id,
        kind: slot,
        storagePath,
        previewDataUrl: processed.previewDataUrl,
        caption: `${slot.replace('_', ' ')} (${contributor?.fullNameCaps || 'Witness'})`,
        taggedRosterIds: contributor ? [contributor.rosterId] : [],
        sha256Hash: processed.sha256,
        width: processed.width,
        height: processed.height,
        isLowRes: processed.isLowRes,
        synced: uploaded,
        error: error || null,
        createdAt: new Date().toISOString(),
      });

      void playSound('shutter');
      awardXp(30, `${slot.replace('_', ' ')} Captured`, `portrait:${slot}`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to process photo. Try another image.'
      );
    } finally {
      setProcessingSlot(null);
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    );
    if (blob) {
      await handleImageBlob(blob, 'worst_face');
    }
  };

  const openWorstFaceCamera = () => {
    cameraBoothRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!cameraActive) {
      void startCamera();
    }
  };

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Hold on, Witness!</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Before we snap your mugshot, tell us who you are on the Witness Details form.
          </p>
          <Link
            href="/details"
            className="tactile-btn mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Go to Witness Details <ArrowRight className="h-4 w-4" />
          </Link>
        </NotebookCard>
      </main>
    );
  }

  const rosterLabel = getRosterById(contributor.rosterId)?.label ?? contributor.rosterId;
  const getSlotUpload = (kind: PortraitSlotKind) =>
    uploads.find((u) => u.kind === kind);

  const portraitDone = Boolean(getSlotUpload('portrait'));

  const handleProceedToDesk = () => {
    if (!portraitDone) {
      setFormError('Upload your Official Portrait from your gallery so your classmates have a face on your dossier.');
      void playSound('error');
      return;
    }
    stopCamera();
    updateContributorFields({ consentPortrait: true });
    void flushSyncQueue();
    void playSound('stamp');
    router.push('/desk');
  };

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <EvidenceTag label="STEP 2 OF 2 • MUGSHOT STATION" tone="red" />
        <span className="font-mono-doc text-xs text-[var(--ink-muted)]">
          EXIF GPS location automatically stripped before upload
        </span>
      </div>

      <NotebookCard>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-typewriter fluid-page-title font-bold">
              Mugshot &amp; Portrait Station
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Upload your Official Portrait and CID Mugshot straight from your gallery. For slot 3
              (&ldquo;Worst Face You Can Make&rdquo;), snap live in the camera booth or upload from
              your gallery.
            </p>
          </div>
          <Stamp text={`#${contributor.scholarNumber}`} color="blue" size="sm" rotate={-3} />
        </div>

        {/* Three Portrait Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SLOTS.map((slot) => {
            const uploaded = getSlotUpload(slot.kind);
            const isWorking = processingSlot === slot.kind;
            return (
              <div
                key={slot.kind}
                className={`flex flex-col justify-between rounded-md border-2 border-[var(--border-ink)] p-3.5 ${
                  slot.supportsCamera ? 'bg-[var(--manila)]' : 'bg-[var(--paper)]'
                }`}
              >
                <div>
                  <span className="font-mono-doc inline-block rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--ink)]">
                    {slot.badge}
                  </span>
                  <h2 className="font-typewriter mt-2 text-base font-bold">{slot.title}</h2>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">{slot.subtitle}</p>

                  <div className="mt-3 flex justify-center">
                    <PolaroidPhoto
                      src={uploaded?.previewDataUrl}
                      caption={uploaded ? rosterLabel : 'Empty Slot'}
                      sublabel={
                        uploaded
                          ? `${uploaded.width}×${uploaded.height}px`
                          : slot.supportsCamera
                          ? 'Camera or Gallery'
                          : 'Upload from Gallery'
                      }
                      rotate={slot.kind === 'mugshot' ? 1.5 : -1.5}
                    />
                  </div>

                  {uploaded?.isLowRes && (
                    <div
                      role="status"
                      className="mt-2 flex items-start gap-1.5 rounded border border-amber-700/50 bg-amber-100 p-2 text-[11px] text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Heads up: short side is under 1000px ({uploaded.width}×{uploaded.height}).
                        Recommend retaking in brighter light or picking an uncropped gallery photo.
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {slot.supportsGrayscale && (
                    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-3 text-xs font-semibold">
                      <span>B&amp;W CID Filter on upload</span>
                      <input
                        type="checkbox"
                        checked={mugshotGrayscale}
                        onChange={(e) => setMugshotGrayscale(e.target.checked)}
                        className="h-4 w-4 accent-[var(--blueprint)]"
                      />
                    </label>
                  )}

                  {slot.supportsCamera && (
                    <button
                      type="button"
                      onClick={openWorstFaceCamera}
                      className="tactile-btn flex w-full items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-3 py-2 text-xs font-bold text-white"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {cameraActive ? 'Live Camera Ready Below' : 'Use Live Camera'}
                    </button>
                  )}

                  <label className="tactile-btn flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--paper-card)] px-3 py-2 text-xs font-bold">
                    {uploaded ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" /> Replace from Gallery
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" /> {isWorking ? 'Stripping EXIF…' : 'Upload from Gallery'}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isWorking}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageBlob(file, slot.kind);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated Live Camera Booth (ONLY for Slot 3: Worst Face You Can Make) */}
        <section
          ref={cameraBoothRef}
          aria-labelledby="worst-face-camera-heading"
          className="mt-6 rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3 sm:p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono-doc inline-block rounded bg-[var(--highlighter)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#14181F]">
                LIVE CAMERA BOOTH • SLOT 3 ONLY
              </span>
              <h2 id="worst-face-camera-heading" className="font-typewriter mt-1 text-base font-bold sm:text-lg">
                3. &ldquo;Worst Face You Can Make&rdquo; — Live Mugshot Cam
              </h2>
            </div>
            <span className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
              Slots 1 &amp; 2 use Gallery Upload only
            </span>
          </div>

          {/* Camera Viewport */}
          <div className="relative mx-auto aspect-[4/3] max-w-lg overflow-hidden rounded-md border-2 border-[var(--border-ink)] bg-[#14181F]">
            {/* Height Chart Backdrop Overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2 opacity-65"
            >
              {['6\'0"', '5\'9"', '5\'6"', '5\'3"', '5\'0"'].map((mark) => (
                <div
                  key={mark}
                  className="flex items-center gap-2 border-b border-dashed border-white/40 pb-0.5 text-[10px] font-mono-doc text-white"
                >
                  <span className="bg-black/50 px-1">{mark}</span>
                </div>
              ))}
            </div>

            {cameraActive ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="relative z-20 flex h-full flex-col items-center justify-center p-4 text-center text-white">
                <Camera className="mb-2 h-10 w-10 opacity-80" />
                <p className="font-typewriter text-sm">
                  Live camera ready for: <strong>3. &ldquo;Worst Face You Can Make&rdquo;</strong>
                </p>
                {cameraError && (
                  <p className="mt-2 flex items-center gap-1.5 rounded bg-[var(--stamp-red)]/90 px-3 py-1.5 text-xs">
                    <VideoOff className="h-4 w-4 shrink-0" />
                    {cameraError}
                  </p>
                )}
              </div>
            )}

            {/* Mugshot Slate Overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-[78%] max-w-[260px] -translate-x-1/2 rounded border-2 border-white/80 bg-[#1B1B1B]/85 px-3 py-1.5 text-center text-white shadow-md"
            >
              <p className="font-mono-doc text-[10px] tracking-[0.2em] text-[#FFE066]">
                BATCH 23 • WORST FACE EXHIBIT
              </p>
              <p className="font-typewriter truncate text-xs font-bold">
                SCHOLAR #{contributor.scholarNumber} • {rosterLabel.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {!cameraActive ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--blueprint)] px-4 py-2.5 text-sm font-bold text-white"
              >
                <Camera className="h-4 w-4" />
                Open Live Camera
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void captureFromCamera()}
                  disabled={processingSlot !== null}
                  className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--stamp-red)] px-5 py-2.5 text-sm font-bold text-white"
                >
                  <Camera className="h-4 w-4" />
                  {processingSlot === 'worst_face' ? 'Processing…' : 'Snap Worst Face'}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--paper)] px-4 py-2.5 text-xs font-bold"
                >
                  Stop Camera
                </button>
              </>
            )}
          </div>
        </section>

        {formError && (
          <p
            role="alert"
            className="mt-3 rounded border-2 border-[var(--stamp-red)] bg-[var(--paper)] p-3 text-xs font-bold text-[var(--stamp-red)]"
          >
            {formError}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Link
            href="/details"
            className="tactile-btn inline-flex items-center justify-center rounded-md bg-[var(--paper)] px-4 py-3 text-sm font-bold"
          >
            ← Back to Details
          </Link>
          <button
            type="button"
            onClick={handleProceedToDesk}
            className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-6 py-3 text-base font-bold text-white"
          >
            <CheckCircle2 className="h-5 w-5" />
            Enter The Case Desk (22 Files)
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </NotebookCard>
    </main>
  );
}
