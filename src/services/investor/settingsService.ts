import { supabase, nowISO } from '../../config/supabase';
import { LIVE_COLLECTIONS } from '../../config/liveCollections';

const GLOBAL_DOC_ID = 'global';

export interface PlatformSettings {
  // Notifications (announcement banner)
  announcementEnabled: boolean;
  announcementMessage: string;

  // General
  platformName: string;
  defaultCurrency: string;
  statementFooterText: string;
  deskTimezone: string;

  // Appearance & Branding
  logoUrl: string;
  brandPrimaryColor: string;
  brandAccentColor: string;

  // Languages
  defaultLanguage: string;
  supportedLanguages: string[];

  // Notifications (admin alert preferences)
  notifyOnNewApplicant: boolean;
  notifyOnFundingRequest: boolean;
  notifyOnLargeTrade: boolean;
  largeTradeThreshold: number;

  // Security
  sessionTimeoutMinutes: number;
  minPasswordLength: number;

  // Email Templates
  welcomeEmailSubjectOverride: string;
  welcomeEmailIntroOverride: string;

  // Invoice numbering (e.g. SG-INV2600001)
  invoicePrefix: string;
  invoiceIncludeYear: boolean;
  invoicePadLength: number;
}

export const DEFAULTS: PlatformSettings = {
  announcementEnabled: false,
  announcementMessage: '',

  platformName: 'SafeGuard Securities',
  defaultCurrency: 'USD',
  statementFooterText: 'SafeGuard Securities · Confidential client statement',
  deskTimezone: 'America/New_York',

  logoUrl: '',
  brandPrimaryColor: '#6366f1',
  brandAccentColor: '#10b981',

  defaultLanguage: 'en',
  supportedLanguages: ['en'],

  notifyOnNewApplicant: true,
  notifyOnFundingRequest: true,
  notifyOnLargeTrade: false,
  largeTradeThreshold: 50000,

  sessionTimeoutMinutes: 60,
  minPasswordLength: 6,

  welcomeEmailSubjectOverride: '',
  welcomeEmailIntroOverride: '',

  invoicePrefix: 'SG-INV',
  invoiceIncludeYear: true,
  invoicePadLength: 5,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from(LIVE_COLLECTIONS.settings)
    .select('*')
    .eq('id', GLOBAL_DOC_ID)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  const d = data;
  return {
    announcementEnabled: Boolean(d.announcement_enabled ?? d.announcementEnabled),
    announcementMessage: d.announcement_message ?? d.announcementMessage ?? DEFAULTS.announcementMessage,
    platformName: d.platform_name ?? d.platformName ?? DEFAULTS.platformName,
    defaultCurrency: d.default_currency ?? d.defaultCurrency ?? DEFAULTS.defaultCurrency,
    statementFooterText: d.statement_footer_text ?? d.statementFooterText ?? DEFAULTS.statementFooterText,
    deskTimezone: d.desk_timezone ?? d.deskTimezone ?? DEFAULTS.deskTimezone,
    logoUrl: d.logo_url ?? d.logoUrl ?? DEFAULTS.logoUrl,
    brandPrimaryColor: d.brand_primary_color ?? d.brandPrimaryColor ?? DEFAULTS.brandPrimaryColor,
    brandAccentColor: d.brand_accent_color ?? d.brandAccentColor ?? DEFAULTS.brandAccentColor,
    defaultLanguage: d.default_language ?? d.defaultLanguage ?? DEFAULTS.defaultLanguage,
    supportedLanguages: Array.isArray(d.supported_languages ?? d.supportedLanguages) ? (d.supported_languages ?? d.supportedLanguages) : DEFAULTS.supportedLanguages,
    notifyOnNewApplicant: d.notify_on_new_applicant ?? d.notifyOnNewApplicant ?? DEFAULTS.notifyOnNewApplicant,
    notifyOnFundingRequest: d.notify_on_funding_request ?? d.notifyOnFundingRequest ?? DEFAULTS.notifyOnFundingRequest,
    notifyOnLargeTrade: d.notify_on_large_trade ?? d.notifyOnLargeTrade ?? DEFAULTS.notifyOnLargeTrade,
    largeTradeThreshold: Number(d.large_trade_threshold ?? d.largeTradeThreshold ?? DEFAULTS.largeTradeThreshold),
    sessionTimeoutMinutes: Number(d.session_timeout_minutes ?? d.sessionTimeoutMinutes ?? DEFAULTS.sessionTimeoutMinutes),
    minPasswordLength: Number(d.min_password_length ?? d.minPasswordLength ?? DEFAULTS.minPasswordLength),
    welcomeEmailSubjectOverride: d.welcome_email_subject_override ?? d.welcomeEmailSubjectOverride ?? DEFAULTS.welcomeEmailSubjectOverride,
    welcomeEmailIntroOverride: d.welcome_email_intro_override ?? d.welcomeEmailIntroOverride ?? DEFAULTS.welcomeEmailIntroOverride,
    invoicePrefix: String(d.invoice_prefix ?? d.invoicePrefix ?? DEFAULTS.invoicePrefix),
    invoiceIncludeYear: d.invoice_include_year !== false,
    invoicePadLength: Number(d.invoice_pad_length ?? d.invoicePadLength ?? DEFAULTS.invoicePadLength),
  };
}

export async function updatePlatformSettings(patch: Partial<PlatformSettings>) {
  await supabase.from(LIVE_COLLECTIONS.settings).upsert({
    id: GLOBAL_DOC_ID,
    ...patch,
    updated_at: nowISO(),
  });
}
