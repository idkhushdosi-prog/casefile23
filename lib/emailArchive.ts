import nodemailer from 'nodemailer';
import { ROSTER, getRosterById } from '@/data/roster';
import { buildCompleteArchiveZip } from '@/lib/archiveBundle';
import {
  getArchiveNotifyEmail,
  getEmailTransportStatus,
  getSupabaseAdminClient,
} from '@/lib/editorAuth';
import type { EditorDataset } from '@/lib/exports';
import { loadServerEditorDataset } from '@/lib/serverEditorData';

const MAX_EMAIL_ATTACHMENT_BYTES = 18 * 1024 * 1024; // 18 MB safe email limit
const STORAGE_ZIP_PATH = 'exports/class-of-23-complete-archive.zip';

export interface EmailArchiveResult {
  sentTo: string;
  provider: 'resend' | 'smtp';
  attachedFilename: string;
  attachedBytes: number;
  fullZipBytes: number;
  includedPhotos: number;
  missingPhotosCount: number;
  fullZipStorageUrl: string | null;
  submittedCount: number;
  totalAnswers: number;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendCompleteArchiveEmail(params: {
  datasetOverride?: EditorDataset;
  trigger: 'auto_23_complete' | 'manual_editor';
}): Promise<EmailArchiveResult> {
  const recipient = getArchiveNotifyEmail();
  const transportStatus = getEmailTransportStatus();

  if (!recipient) {
    throw new Error('ARCHIVE_NOTIFY_EMAIL is not configured in environment variables.');
  }
  if (!transportStatus.provider) {
    throw new Error(
      'No email transport configured. Set RESEND_API_KEY or SMTP_USER + SMTP_PASS.'
    );
  }

  const supabase = getSupabaseAdminClient();
  let dataset: EditorDataset | undefined = params.datasetOverride;

  if (!dataset) {
    if (!supabase) {
      throw new Error(
        'Cannot load dataset: SUPABASE_SERVICE_ROLE_KEY or Supabase URL is missing.'
      );
    }
    const loaded = await loadServerEditorDataset(supabase);
    dataset = loaded.dataset;
  }

  const fetchPhotoBytes = supabase
    ? async (storagePath: string): Promise<Uint8Array | null> => {
        const { data, error } = await supabase.storage.from('keepsake').download(storagePath);
        if (error || !data) return null;
        const arr = await data.arrayBuffer();
        return new Uint8Array(arr);
      }
    : undefined;

  const bundle = await buildCompleteArchiveZip({
    dataset,
    fetchPhotoBytes,
  });

  // Upload complete ZIP (with all high-res photos) to private bucket for guaranteed backup link
  let fullZipStorageUrl: string | null = null;
  if (supabase) {
    const { error: uploadErr } = await supabase.storage
      .from('keepsake')
      .upload(STORAGE_ZIP_PATH, Buffer.from(bundle.fullZip), {
        contentType: 'application/zip',
        upsert: true,
      });

    if (!uploadErr) {
      const { data: signed } = await supabase.storage
        .from('keepsake')
        .createSignedUrl(STORAGE_ZIP_PATH, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        fullZipStorageUrl = signed.signedUrl;
      }
    }
  }

  const fullFitsInEmail = bundle.fullZip.byteLength <= MAX_EMAIL_ATTACHMENT_BYTES;
  const attachedBuffer = Buffer.from(fullFitsInEmail ? bundle.fullZip : bundle.dataOnlyZip);
  const attachedFilename = fullFitsInEmail
    ? 'class-of-23-complete-archive.zip'
    : 'class-of-23-all-answers-and-4-formats.zip';

  const submittedContributors = dataset.contributors.filter((c) => c.status === 'submitted');
  const submittedNames = submittedContributors
    .map((c) => {
      const label = getRosterById(c.roster_id)?.label ?? c.roster_id;
      return `${label} (${c.full_name_caps}, #${c.scholar_number})`;
    })
    .join(', ');

  const subject =
    params.trigger === 'auto_23_complete'
      ? `🎉 CASE FILE: CLASS OF 23 — All ${ROSTER.length}/${ROSTER.length} Submissions Complete! Full Archive Inside`
      : `📦 CASE FILE: CLASS OF 23 — Complete Keepsake Archive (${bundle.submittedCount}/${ROSTER.length} Submitted)`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #1b1b1b; background: #f6eedb; border: 2px solid #1b1b1b; padding: 24px; border-radius: 6px;">
      <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.15em; color: #c8102e; margin: 0 0 8px; font-weight: bold;">
        BUREAU DISPATCH • CASE FILE: CLASS OF 23
      </p>
      <h1 style="margin: 0 0 12px; font-size: 22px;">
        ${
          params.trigger === 'auto_23_complete'
            ? 'All 23 Case Files Are Officially Complete!'
            : 'Class of 23 Master Data Export Ready'
        }
      </h1>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
        Every peer answer, skip note, award ballot, class archive memory, student dossier, and all 4 keepsake production datasets are packaged in the attached ZIP file.
      </p>

      <div style="background: #ffffff; border: 1.5px solid #1b1b1b; padding: 14px; border-radius: 4px; margin-bottom: 16px; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Witnesses Submitted:</strong> ${bundle.submittedCount} / ${ROSTER.length}</p>
        <p style="margin: 4px 0;"><strong>Total Question Answers Logged:</strong> ${bundle.totalAnswers}</p>
        <p style="margin: 4px 0;"><strong>Photos Packaged in Full ZIP:</strong> ${bundle.includedPhotos} of ${dataset.uploads.length}</p>
        <p style="margin: 4px 0;"><strong>Attached File:</strong> <code>${escapeHtml(attachedFilename)}</code> (${(attachedBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB)</p>
      </div>

      ${
        !fullFitsInEmail && fullZipStorageUrl
          ? `<div style="background: #ffe066; border: 2px solid #1b1b1b; padding: 14px; border-radius: 4px; margin-bottom: 16px; font-size: 13px;">
              <strong>Full Photos + Data ZIP (${(bundle.fullZip.byteLength / (1024 * 1024)).toFixed(1)} MB) exceeded email attachment size limits.</strong><br/>
              All answers & CSVs are attached to this email, and the complete ZIP including all original high-res photos is ready at this private 7-day link:<br/><br/>
              <a href="${escapeHtml(fullZipStorageUrl)}" style="display: inline-block; background: #1f3a93; color: #ffffff; padding: 10px 16px; text-decoration: none; font-weight: bold; border-radius: 4px;">
                Download Full Archive ZIP (With All Photos)
              </a>
            </div>`
          : fullZipStorageUrl
          ? `<p style="font-size: 12px; margin-bottom: 16px;">
              7-day Supabase backup download link (Data + Photos): <a href="${escapeHtml(fullZipStorageUrl)}">Download Complete Archive ZIP</a>
            </p>`
          : ''
      }

      <h2 style="font-size: 15px; margin: 0 0 8px;">What&apos;s Inside the ZIP:</h2>
      <ul style="font-size: 13px; line-height: 1.6; margin: 0 0 16px; padding-left: 20px;">
        <li><strong>4-formats/</strong> — <code>1-stat-deck.csv</code>, <code>2-ncert-book.csv</code>, <code>3-cid-dossier.csv</code>, <code>4-photo-manga.json</code></li>
        <li><strong>all-answers/</strong> — <code>all-question-answers.csv</code> (every single Q1–Q25 answer), <code>awards-tallies-and-votes.csv</code>, <code>class-archive-entries.csv</code>, <code>anything-else-notes.csv</code>, <code>case-skip-reasons.csv</code>, <code>contributors-directory.csv</code>, <code>raw-complete-backup.json</code></li>
        <li><strong>students/</strong> — 23 individual readable Markdown dossiers (<code>01-afsha.md</code> … <code>23-yashika.md</code>) + <code>all-student-profiles.json</code></li>
        <li><strong>photos/</strong> — Portraits, CID mugshots, worst faces, chaos candid photos &amp; <code>MANIFEST.txt</code></li>
      </ul>

      <p style="font-size: 12px; color: #555; margin: 0;">
        <strong>Submitted Witnesses:</strong> ${escapeHtml(submittedNames || 'None yet')}
      </p>
    </div>
  `;

  const text = [
    'CASE FILE: CLASS OF 23 — COMPLETE KEEPSAKE ARCHIVE',
    `Submitted Witnesses: ${bundle.submittedCount}/${ROSTER.length}`,
    `Total Answers Logged: ${bundle.totalAnswers}`,
    `Photos Included: ${bundle.includedPhotos}/${dataset.uploads.length}`,
    `Attached ZIP: ${attachedFilename}`,
    fullZipStorageUrl ? `Full ZIP 7-day download link: ${fullZipStorageUrl}` : '',
    '',
    `Witnesses: ${submittedNames || 'None yet'}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (transportStatus.provider === 'resend') {
    const fromAddr = (process.env.EMAIL_FROM || 'CASE FILE 23 <onboarding@resend.dev>').trim();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [recipient],
        subject,
        html,
        text,
        attachments: [
          {
            filename: attachedFilename,
            content: attachedBuffer.toString('base64'),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Resend API error (${res.status}): ${errBody || 'Failed to send email.'}`);
    }
  } else {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
    });

    await transporter.sendMail({
      from: (process.env.EMAIL_FROM || process.env.SMTP_USER!).trim(),
      to: recipient,
      subject,
      text,
      html,
      attachments: [
        {
          filename: attachedFilename,
          content: attachedBuffer,
          contentType: 'application/zip',
        },
      ],
    });
  }

  return {
    sentTo: recipient,
    provider: transportStatus.provider,
    attachedFilename,
    attachedBytes: attachedBuffer.byteLength,
    fullZipBytes: bundle.fullZip.byteLength,
    includedPhotos: bundle.includedPhotos,
    missingPhotosCount: bundle.missingPhotos.length,
    fullZipStorageUrl,
    submittedCount: bundle.submittedCount,
    totalAnswers: bundle.totalAnswers,
  };
}
