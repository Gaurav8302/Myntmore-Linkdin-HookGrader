import { MyntmoreService } from "../types.js";

export const QUALIFICATION_VERSION = "service_rubric_v1";

export const SERVICE_DISPLAY: Record<MyntmoreService, string> = {
  linkedin_outreach: "LinkedIn Outreach & Automation",
  cold_email: "Cold Email Infrastructure",
  icp_mapping: "ICP Mapping & Lead Scoring",
  ai_lead_generation: "AI Lead Generation",
  account_based_marketing: "Account-Based Marketing",
  personal_branding: "Personal Branding",
  gtm_strategy: "GTM Strategy",
};

/** Allowed official service names for NVIDIA / external validation. */
export const ALLOWED_SERVICE_DISPLAY = Object.values(SERVICE_DISPLAY);

export function displayToService(name: string): MyntmoreService | null {
  const needle = name.trim().toLowerCase();
  for (const [id, label] of Object.entries(SERVICE_DISPLAY) as Array<
    [MyntmoreService, string]
  >) {
    if (label.toLowerCase() === needle || id === needle.replace(/\s+/g, "_")) {
      return id;
    }
  }
  // Common aliases
  if (/linkedin outreach/.test(needle)) return "linkedin_outreach";
  if (/cold email/.test(needle)) return "cold_email";
  if (/icp|lead scoring|sales intelligence/.test(needle)) return "icp_mapping";
  if (/ai lead|lead generation/.test(needle)) return "ai_lead_generation";
  if (/account.based|abm/.test(needle)) return "account_based_marketing";
  if (/personal brand/.test(needle)) return "personal_branding";
  if (/gtm|go.to.market/.test(needle)) return "gtm_strategy";
  return null;
}

export interface ServiceSignalDef {
  id: MyntmoreService;
  patterns: RegExp[];
  /** Weight when pattern matches in tool input/output. */
  weight: number;
}

/**
 * Signals grounded in Myntmore service pages (myntmore.com/services/*).
 * Matching is evidence-based; do not invent company facts.
 */
export const SERVICE_SIGNALS: ServiceSignalDef[] = [
  {
    id: "linkedin_outreach",
    weight: 2,
    patterns: [
      /\bconnection requests?\b/i,
      /\blinkedin (outreach|dm|inbox|messages?|automation)\b/i,
      /\breply (rate|management|handoff)\b/i,
      /\bacceptance rate\b/i,
      /\bdm angles?\b/i,
      /\bmulti-?touch sequences?\b/i,
      /\bmeeting booking\b/i,
      /\bprofile (audit|optimis|optimiz).{0,20}outbound\b/i,
    ],
  },
  {
    id: "cold_email",
    weight: 2,
    patterns: [
      /\bcold email\b/i,
      /\b(spf|dkim|dmarc)\b/i,
      /\b(spam|bounce|deliverability|inbox placement|inbox rate)\b/i,
      /\bdomain warmup\b/i,
      /\bsending domains?\b/i,
      /\boutbound.?sequences?\b/i,
      /\bbattle card\b/i,
    ],
  },
  {
    id: "icp_mapping",
    weight: 2,
    patterns: [
      /\bicp\b/i,
      /\bideal customer\b/i,
      /\blead scoring\b/i,
      /\bintent (signals?|triggered)\b/i,
      /\baccount prioritisation\b|\baccount prioritization\b/i,
      /\b(funding events?|hiring surges?|leadership moves?|tech-?stack)\b/i,
      /\bstale (lists?|leads?)\b/i,
      /\bscored exports?\b/i,
    ],
  },
  {
    id: "ai_lead_generation",
    weight: 2,
    patterns: [
      /\bai (agents?|lead|research)\b/i,
      /\bmanual research\b/i,
      /\bresearch summaries?\b/i,
      /\benrich(ment|ed)?\b/i,
      /\bqualify and (rank|prioritis|prioritiz)\b/i,
      /\blead magnet\b/i,
      /\bcase study generator\b/i,
      /\bscored,? research-enriched\b/i,
    ],
  },
  {
    id: "account_based_marketing",
    weight: 2,
    patterns: [
      /\baccount-?based\b|\babm\b/i,
      /\bnamed accounts?\b/i,
      /\btarget accounts?\b/i,
      /\bbuying committee\b/i,
      /\baccount tiers?\b/i,
      /\bmulti-?channel campaigns?\b/i,
      /\bcomplex b2b sales\b/i,
    ],
  },
  {
    id: "personal_branding",
    weight: 2,
    patterns: [
      /\bpersonal brand/i,
      /\bghostwrit/i,
      /\b(posts?|content) (per month|\/month)\b/i,
      /\bvoice interviews?\b/i,
      /\bfounder presence\b/i,
      /\bprofile optimi[sz]er\b/i,
      /\bposting rhythm\b/i,
      /\bauthority (on linkedin|in your space)\b/i,
      /\binbound (finds|tracking)\b/i,
      /\blinkedin hook\b/i,
      /\bhook grader\b/i,
    ],
  },
  {
    id: "gtm_strategy",
    weight: 2,
    patterns: [
      /\bgtm\b|\bgo-?to-?market\b/i,
      /\bpositioning\b/i,
      /\bchannel (mix|prioriti[sz]ation)\b/i,
      /\bnew (market|segment|geography)\b/i,
      /\bbuyer-?journey\b/i,
      /\bcompetitive mapping\b/i,
      /\bmessaging alignment\b/i,
    ],
  },
];

/** Soft priors from free-tool source — not sole assignment. */
export const TOOL_SERVICE_PRIOR: Record<string, MyntmoreService> = {
  profile_optimizer: "personal_branding",
  founder_presence_analyzer: "personal_branding",
  posting_rhythm_builder: "personal_branding",
  dm_angle_generator: "linkedin_outreach",
  roi_calculator: "linkedin_outreach",
  battle_card_generator: "cold_email",
  case_study_generator: "ai_lead_generation",
  icp_builder: "icp_mapping",
  lead_magnet_ideas: "ai_lead_generation",
  /** Parallel source into the shared pipeline (soft prior only). */
  linkedin_hook_grader: "personal_branding",
};
