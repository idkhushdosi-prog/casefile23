import { z } from 'zod';
import { ROSTER } from '@/data/roster';
import { TEXT_LIMITS } from '@/data/questions';

const ROSTER_IDS = new Set(ROSTER.map((r) => r.id));

/**
 * Clean & sanitize contributor name input:
 * - Uppercase
 * - Allow letters (Unicode letters), spaces, dots, hyphens, apostrophes
 * - Reject digits and other symbols (by stripping or validating)
 */
export function sanitizeNamePartInput(raw: string): string {
  // Remove digits and forbidden symbols, uppercase, collapse multiple spaces
  return raw
    .toUpperCase()
    .replace(/[^A-Z\p{L}\s.'-]/gu, '')
    .replace(/\s{2,}/g, ' ');
}

export function normalizeNamePartSave(raw: string): string {
  return sanitizeNamePartInput(raw).trim().replace(/\s+/g, ' ');
}

export function buildFullNameCaps(
  first: string,
  middle: string | undefined | null,
  last: string
): string {
  return [first, middle, last]
    .map((p) => normalizeNamePartSave(p || ''))
    .filter(Boolean)
    .join(' ');
}

const NAME_PART_REGEX = /^[\p{L}][ \p{L}.'-]*$/u;

export const contributorDetailsSchema = z.object({
  rosterId: z
    .string()
    .min(1, 'Pick your name from the class list first, witness.')
    .refine((val) => ROSTER_IDS.has(val), 'Choose a valid classmate from the dropdown.'),
  scholarNumber: z
    .string()
    .trim()
    .regex(/^\d{3,5}$/, 'Scholar number must be 3 to 5 digits (e.g. 214, 1087, 20431).'),
  firstNameCaps: z
    .string()
    .transform((v) => normalizeNamePartSave(v))
    .refine((v) => v.length >= 1, 'First name is required—unless you go by mononym.')
    .refine(
      (v) => NAME_PART_REGEX.test(v),
      'Letters, spaces, dots, hyphens, and apostrophes only. No digits or weird symbols.'
    ),
  middleNameCaps: z
    .string()
    .optional()
    .default('')
    .transform((v) => normalizeNamePartSave(v))
    .refine(
      (v) => v === '' || NAME_PART_REGEX.test(v),
      'Letters, spaces, dots, hyphens, and apostrophes only.'
    ),
  lastNameCaps: z
    .string()
    .transform((v) => normalizeNamePartSave(v))
    .refine((v) => v.length >= 1, 'Surname / last name is required for the official dossier.')
    .refine(
      (v) => NAME_PART_REGEX.test(v),
      'Letters, spaces, dots, hyphens, and apostrophes only.'
    ),
  honeypot: z.string().max(0, 'Nice try, automated bot.').optional().default(''),
});

export type ContributorDetailsInput = z.input<typeof contributorDetailsSchema>;
export type ContributorDetailsOutput = z.output<typeof contributorDetailsSchema>;

export function sanitizeText(raw: string, maxLen: number = TEXT_LIMITS.SHORT): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

export const skipReasonSchema = z
  .object({
    reasonChoice: z.string().min(1, 'Pick an excuse for the file before skipping.'),
    reasonText: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.reasonChoice === 'Other' && countWords(data.reasonText) < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasonText'],
        message: `Court requires at least 10 words for "Other" (currently ${countWords(
          data.reasonText
        )}).`,
      });
    }
  });
