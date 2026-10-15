const TOOL_TO_SERVICE = {
  profile_optimizer: 'personal_branding',
  founder_presence_analyzer: 'personal_branding',
  posting_rhythm_builder: 'personal_branding',
  dm_angle_generator: 'linkedin_outreach',
  roi_calculator: 'linkedin_outreach',
  battle_card_generator: 'cold_email',
  case_study_generator: 'ai_lead_generation',
  icp_builder: 'icp_mapping',
  lead_magnet_ideas: 'ai_lead_generation',
  linkedin_hook_grader: 'personal_branding',
};
const SERVICE_DISPLAY = {
  linkedin_outreach: 'LinkedIn Outreach & Automation',
  cold_email: 'Cold Email Infrastructure',
  icp_mapping: 'ICP Mapping & Lead Scoring',
  ai_lead_generation: 'AI Lead Generation',
  account_based_marketing: 'Account-Based Marketing',
  personal_branding: 'Personal Branding',
  gtm_strategy: 'GTM Strategy',
};
const QUAL_VERSION = 'service_rubric_v1';
const TEST_TOKENS = new Set(['test','asdf','foo','bar','sample','dummy']);
const CTA = 'myntmore.com/founder-meeting';

function norm(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function normEmail(raw){
  const e = norm(raw).toLowerCase();
  if(!e) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(e) ? e : null;
}
function mapService(t){ return TOOL_TO_SERVICE[t] || 'ai_lead_generation'; }

function scoreServiceFits(clean){
  const corpus = [clean.normalized.toolInput, clean.normalized.toolOutput, clean.normalized.sourceTool.replace(/_/g,' '), clean.normalized.designation].join('\n');
  const defs = [
    {id:'linkedin_outreach', weight:2, patterns:[/\bconnection requests?\b/i,/\blinkedin (outreach|dm|inbox|messages?|automation)\b/i,/\breply (rate|management)\b/i,/\bacceptance rate\b/i,/\bdm angles?\b/i]},
    {id:'cold_email', weight:2, patterns:[/\bcold email\b/i,/\b(spf|dkim|dmarc)\b/i,/\b(spam|bounce|deliverability|inbox)\b/i,/\bbattle card\b/i]},
    {id:'icp_mapping', weight:2, patterns:[/\bicp\b/i,/\bideal customer\b/i,/\blead scoring\b/i,/\bintent\b/i]},
    {id:'ai_lead_generation', weight:2, patterns:[/\bai (agents?|lead|research)\b/i,/\bmanual research\b/i,/\benrich/i,/\blead magnet\b/i,/\bcase study\b/i]},
    {id:'account_based_marketing', weight:2, patterns:[/\baccount-?based\b|\babm\b/i,/\bnamed accounts?\b/i,/\btarget accounts?\b/i,/\bbuying committee\b/i]},
    {id:'personal_branding', weight:2, patterns:[/\bpersonal brand/i,/\bghostwrit/i,/\bfounder presence\b/i,/\bposting rhythm\b/i,/\bposts? (per month|a month)\b/i,/\blinkedin hook\b/i,/\bhook grader\b/i]},
    {id:'gtm_strategy', weight:2, patterns:[/\bgtm\b|\bgo-?to-?market\b/i,/\bpositioning\b/i,/\bchannel mix\b/i]},
  ];
  const scores = defs.map(d=>{
    let points=0; const matched=[];
    for(const p of d.patterns){ if(p.test(corpus)){ points+=d.weight; matched.push(p.source.slice(0,40)); } }
    return {service:d.id, points, matchedSignals:matched};
  });
  const prior = TOOL_TO_SERVICE[clean.normalized.sourceTool];
  if(prior){ const e=scores.find(s=>s.service===prior); if(e){ e.points+=1; e.matchedSignals.push('tool_prior:'+clean.normalized.sourceTool); } }
  const abm=scores.find(s=>s.service==='account_based_marketing');
  if(abm && !/\b(named accounts?|target accounts?|buying committee|account-?based|\babm\b)/i.test(corpus)) abm.points=Math.min(abm.points,1);
  return scores.sort((a,b)=>b.points-a.points);
}

function qualify(clean){
  const hard = clean.flags.some(f=>['test_entry','non_buyer','prompt_injection','malformed'].includes(f));
  if(hard){
    return { primary: TOOL_TO_SERVICE[clean.normalized.sourceTool]||null, secondary:null, reason:'Excluded — '+clean.reasons.join('; '), method:'rules_only', status:'excluded', exclusionReason:clean.reasons.join('; '), version:QUAL_VERSION };
  }
  const fits = scoreServiceFits(clean);
  const top=fits[0], second=fits[1];
  if(!top || top.points<2){
    const prior = TOOL_TO_SERVICE[clean.normalized.sourceTool]||null;
    return { primary: prior, secondary:null, reason: prior ? ('Insufficient signals; tool prior '+SERVICE_DISPLAY[prior]) : 'Insufficient evidence', method:'rules_only', status:'needs_review', exclusionReason: prior?null:'insufficient_service_evidence', version:QUAL_VERSION };
  }
  let primary=top.service;
  let secondary = (second && second.points>=2 && second.service!==primary) ? second.service : null;
  let status='qualified';
  if(second && second.points>=2 && top.points-second.points<=1) status='needs_review';
  const evidence=(top.matchedSignals||[]).slice(0,3).join('; ')||'tool prior';
  let reason='Primary '+SERVICE_DISPLAY[primary]+' from submitted signals ('+evidence+').'+(secondary?(' Secondary: '+SERVICE_DISPLAY[secondary]+'.'):'');
  if(clean.flags.includes('duplicate_contact')) reason+=' Duplicate contact session retained.';
  return { primary, secondary, reason, method:'rules_only', status, exclusionReason:null, version:QUAL_VERSION };
}

function draftId(idem, tier){
  // Stable-enough id for n8n demo without crypto module
  let h=0; const s=idem+'|'+tier+'|draft_v1';
  for(let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0;
  return 'draft_'+Math.abs(h).toString(16)+'_'+tier;
}

function buildArtifact(raw, clean, qual, routed, emailDraft, sourceLabel){
  if(!emailDraft || emailDraft.blocked || (routed.tier!=='hot' && routed.tier!=='warm')) return null;
  return {
    draft_id: draftId(clean.idempotencyKey, routed.tier),
    lead_id: raw.lead_id,
    source: sourceLabel,
    lead_temperature: routed.tier==='hot'?'Hot':'Warm',
    service_fit_primary: qual.primary ? SERVICE_DISPLAY[qual.primary] : 'Unassigned',
    service_fit_secondary: qual.secondary ? SERVICE_DISPLAY[qual.secondary] : null,
    subject: emailDraft.subject,
    recipient: clean.normalized.email || 'unknown@invalid.local',
    body: emailDraft.body,
    cta_url: 'https://myntmore.com/founder-meeting',
    status: 'draft_only',
    send_attempted: false,
    qualification_reason: qual.reason,
    created_at: new Date().toISOString(),
    validation_ok: !emailDraft.blocked,
    validation_errors: emailDraft.validationErrors||[],
    draft_source: emailDraft.source,
  };
}

function classify(raw, byEmail, idempotencyKey){
  const n = {
    firstName: norm(raw.first_name), lastName: norm(raw.last_name),
    fullName: norm(raw.first_name+' '+raw.last_name),
    designation: norm(raw.designation), email: normEmail(raw.email),
    company: norm(raw.company)||null, companyWebsite: norm(raw.company_website)||null,
    linkedinUrl: norm(raw.linkedin_url)||null, sourceTool: norm(raw.source_tool).toLowerCase(),
    createdAt: norm(raw.created_at), toolInput: norm(raw.tool_input), toolOutput: norm(raw.tool_output),
  };
  const flags = new Set(); const reasons = [];
  if(!String(raw.email||'').trim()){ flags.add('missing_email'); reasons.push('Email is empty'); }
  else if(!n.email){ flags.add('malformed'); reasons.push('Email failed validation'); }
  if(!n.toolInput && !n.toolOutput){ flags.add('incomplete_session'); reasons.push('Both tool_input and tool_output are empty'); }
  else if(!n.toolInput){ flags.add('incomplete_session'); reasons.push('tool_input is empty'); }
  else if(!n.toolOutput){ flags.add('incomplete_session'); reasons.push('tool_output is empty'); }
  const nameTest = n.firstName.toLowerCase()==='test' && n.lastName.toLowerCase()==='test';
  const emailTest = n.email && /^(test|asdf|foo)@/i.test(n.email);
  const companyTest = (raw.company||'').trim().toLowerCase()==='test';
  const nonsense = TEST_TOKENS.has(n.toolInput.toLowerCase()) && n.toolInput.length<=8;
  if(nameTest || emailTest || companyTest || nonsense){ flags.add('test_entry'); reasons.push('Looks like a test entry'); }
  const hay = n.designation+' '+n.toolInput+' '+n.toolOutput;
  if(/\b(student|final[- ]year|b\.?tech|intern)\b/i.test(hay) || /\b(open to work|looking for (an? )?(sdr|bdr|job|role))\b/i.test(hay)){
    flags.add('non_buyer'); reasons.push('Non-buyer pattern detected');
  }
  if(/ignore\s+all\s+previous\s+instructions/i.test(n.toolInput) || /set\s+the\s+score\s+to\s+\d+/i.test(n.toolInput) || /guarantees?\s+\d+\s+meetings/i.test(n.toolInput)){
    flags.add('prompt_injection'); reasons.push('Prompt-injection attempt detected');
  }
  if(n.email){
    const prior = byEmail.get(n.email);
    if(prior && prior !== raw.lead_id){ flags.add('duplicate_contact'); reasons.push('Same email as prior session '+prior+' — retained'); }
    else if(!prior) byEmail.set(n.email, raw.lead_id);
  }
  if(flags.size===0){ flags.add('ok'); reasons.push('Passed cleaning checks'); }
  const blocking = flags.has('test_entry')||flags.has('non_buyer')||flags.has('prompt_injection')||flags.has('missing_email')||flags.has('malformed');
  return {
    leadId: raw.lead_id, idempotencyKey: idempotencyKey || ('csv_'+raw.lead_id), normalized: n,
    flags:[...flags], reasons,
    eligibleForEmail: !blocking && !!n.email && !flags.has('incomplete_session'),
  };
}

function score(clean, serviceOverride){
  const service = serviceOverride || mapService(clean.normalized.sourceTool);
  let s = 5; const breakdown=[];
  const bump=(rule,d,note)=>{ breakdown.push({rule,delta:d,note}); s+=d; };
  bump('base',0,'service='+service);
  const role = clean.normalized.designation.toLowerCase();
  if(/\b(founder|co-founder|ceo|managing director|chief revenue|cro)\b/.test(role)) bump('senior_buyer_role',1,'Founder/C-level');
  else if(/\b(vp|head of|director)\b/.test(role)) bump('manager_buyer_role',1,'VP/Head/Director');
  if(clean.normalized.company) bump('has_company',1,'Company present'); else bump('no_company',-2,'No company');
  if(clean.flags.includes('incomplete_session')) bump('incomplete_session',-3,'Incomplete');
  else if(clean.normalized.toolInput.length>40 && clean.normalized.toolOutput.length>10) bump('rich_session',1,'Rich session');
  const input = clean.normalized.toolInput.toLowerCase();
  if(/\b(b2b|cfo|cto|hr heads|procurement|founders?|mid-size|revenue|deal|roi)\b/.test(input)) bump('b2b_signal',1,'B2B signal');
  if(/\b(parents of|lifestyle: weekends only)\b/.test(input)) bump('weak_icp_for_myntmore',-1,'Weak ICP');
  if(/ghostwriter|i write linkedin posts for founders/i.test(input)) bump('adjacent_offer',-1,'Adjacent offer');
  if(clean.flags.includes('test_entry')) bump('test_entry_cap',-8,'Test');
  if(clean.flags.includes('non_buyer')) bump('non_buyer_cap',-6,'Non-buyer');
  if(clean.flags.includes('prompt_injection')) bump('injection_cap',-8,'Injection');
  if(clean.flags.includes('missing_email')||clean.flags.includes('malformed')) bump('bad_email',-2,'Bad email');
  if(clean.flags.includes('duplicate_contact')) bump('duplicate_session',-1,'Duplicate session');
  const scoreVal = Math.min(10, Math.max(1, Math.round(s)));
  const drivers = breakdown.filter(b=>b.delta!==0).slice(0,2).map(b=>b.note).join('; ');
  return { score: scoreVal, service, scoreReason: service.replace(/_/g,' ')+' fit '+scoreVal+'/10 — '+drivers, ruleBreakdown: breakdown };
}

function route(clean, scored){
  const blocked = clean.flags.some(f=>['test_entry','non_buyer','prompt_injection','missing_email','malformed'].includes(f));
  if(blocked) return { tier:'not_a_fit', alertRequired:false, draftEmailRequired:false, reason:'Not a fit — '+clean.reasons.join('; ') };
  if(!clean.eligibleForEmail) return { tier:'not_a_fit', alertRequired:false, draftEmailRequired:false, reason:'Not a fit — incomplete session' };
  if(scored.score>=8) return { tier:'hot', alertRequired:true, draftEmailRequired:true, reason:'Hot — score '+scored.score+'/10' };
  if(scored.score>=5) return { tier:'warm', alertRequired:false, draftEmailRequired:true, reason:'Warm — score '+scored.score+'/10' };
  return { tier:'not_a_fit', alertRequired:false, draftEmailRequired:false, reason:'Not a fit — score '+scored.score+'/10' };
}

function templateDraft(clean, service, tier){
  const first = clean.normalized.firstName || 'there';
  const tool = clean.normalized.sourceTool.replace(/_/g,' ');
  const company = clean.normalized.company;
  const clip = (t,m)=>{ t=String(t||'').replace(/\s+/g,' ').trim(); return !t?'':(t.length<=m?t:t.slice(0,m-1)+'…'); };
  const subject = tier==='hot' ? ('Quick note on your '+tool+' results') : ('Following up on your '+tool+' session');
  const body = [
    'Hi '+first+',','',
    company ? ("Thanks for trying Myntmore's "+tool+' for '+company+'.') : ("Thanks for trying Myntmore's "+tool+'.'),
    clip(clean.normalized.toolInput,90) ? ('You shared: '+clip(clean.normalized.toolInput,90)) : null,
    clip(clean.normalized.toolOutput,90) ? ('The tool returned: '+clip(clean.normalized.toolOutput,90)) : null,
    'If helpful, we can talk about '+service.replace(/_/g,' ')+' next steps.',
    'Book a founder meeting: https://'+CTA,'','Best,','Myntmore'
  ].filter(Boolean).join('\n');
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  return { subject, body, wordCount, source:'template_fallback', isFallback:true, fallbackReason:'n8n_template_no_gemini_credential', blocked: wordCount>=120 || !body.includes(CTA), validationErrors:[] };
}

function disposition(flags, tier, errors){
  if(errors.some(e=>!e.recoverable)) return 'failed';
  if(tier==='not_a_fit') return 'excluded';
  if(flags.includes('duplicate_contact')) return 'duplicate_retained';
  return 'processed';
}



// Make.com Hook Grader → shared RawLead contract + same clean/qualify/score/route/draft as CSV path.
// Hook quality score stays in tool_output only — never used as lead score / routing_tier.

function makePayloadToRawLead(b) {
  const contact = b.contact || {};
  const hook = b.hook || {};
  const rewrites = Array.isArray(b.rewrites) ? b.rewrites : [];
  const name = String(contact.name || '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const sessionId = String(b.session_id || '').trim();
  const idem = String(b.idempotency_key || (sessionId ? ('hook_grader_' + sessionId) : '')).trim();
  if (!idem) throw new Error('Missing idempotency_key');
  const email = String(contact.email || '').trim();
  const originalHook = String(hook.original || '').trim();
  if (!email || !email.includes('@')) throw new Error('Missing or invalid contact.email');
  if (!name) throw new Error('Missing contact.name');
  if (!originalHook) throw new Error('Missing hook.original');
  const score100 = Number(hook.score);
  const failed = Array.isArray(hook.failed_rules) ? hook.failed_rules.filter(Boolean) : [];
  const passed = Array.isArray(hook.passed_rules) ? hook.passed_rules.filter(Boolean) : [];
  const outLines = [];
  outLines.push(Number.isFinite(score100) ? ('Hook Grader score ' + score100 + '/100') : 'Hook Grader score unavailable');
  outLines.push(failed.length ? ('Failed rules: ' + failed.join('; ')) : 'Failed rules: none');
  if (passed.length) outLines.push('Passed rules: ' + passed.slice(0, 8).join('; '));
  for (let i = 0; i < Math.min(3, rewrites.length); i++) {
    const t = String((rewrites[i] && rewrites[i].hook) || '').trim();
    if (t) outLines.push('Rewrite ' + (i + 1) + ': ' + t);
  }
  const designation = (contact.designation == null || contact.designation === '') ? '' : String(contact.designation).trim();
  return {
    raw: {
      lead_id: sessionId || idem.replace(/^hook_grader_/, ''),
      created_at: String(b.timestamp || new Date().toISOString()),
      source_tool: 'linkedin_hook_grader',
      first_name: parts[0] || name,
      last_name: parts.length > 1 ? parts.slice(1).join(' ') : '',
      designation,
      email,
      company: '',
      company_website: '',
      linkedin_url: '',
      tool_input: originalHook,
      tool_output: outLines.join('\n'),
    },
    idempotencyKey: idem,
    hookScore100: Number.isFinite(score100) ? score100 : null,
  };
}

function processSingleRawLead(raw, opts) {
  const sourceLabel = opts.source || 'csv';
  const idempotencyKey = opts.idempotencyKey || null;
  const byEmail = opts.byEmail || new Map();
  const errors = [];
  const clean = classify(raw, byEmail, idempotencyKey);
  const qual = qualify(clean);
  const scored = score(clean, qual.primary);
  const routed = route(clean, scored);
  let emailDraft = null;
  let draftStatus = 'skipped';
  let draftArtifact = null;
  if (routed.draftEmailRequired && clean.eligibleForEmail) {
    emailDraft = templateDraft(clean, scored.service, routed.tier);
    draftStatus = emailDraft.blocked ? 'blocked' : 'template_fallback';
    draftArtifact = buildArtifact(raw, clean, qual, routed, emailDraft, sourceLabel);
    errors.push({ stage:'email', code:'NVIDIA_DEFERRED_IN_N8N', message:'n8n uses validated template fallback; JSON draft artifact still emitted (never send)', recoverable:true });
  }
  const zoho = (!routed.draftEmailRequired)
    ? { mode:'draft_only', wouldCreateDraft:false, status:'skipped', detail:'Not a fit — no email draft. Qualification summary only.' }
    : (!emailDraft || emailDraft.blocked)
      ? { mode:'draft_only', wouldCreateDraft:false, status:'blocked', detail:'Draft blocked' }
      : { mode:'draft_only', wouldCreateDraft:true, status:'dry_run_queued', detail:'JSON draft artifact ready; native Zoho __email_drafts via shared processIncomingLead (refresh-token OAuth; never send).' };
  const disp = disposition(clean.flags, routed.tier, errors);
  const zoho_qualification = [
    '[MYNTMORE QUALIFICATION — DO NOT SEND]',
    'Primary: '+(qual.primary?SERVICE_DISPLAY[qual.primary]:'none'),
    'Secondary: '+(qual.secondary?SERVICE_DISPLAY[qual.secondary]:'none'),
    'Score: '+scored.score+'/10',
    'Temperature: '+routed.tier,
    'Method: '+qual.method,
    'Status: '+qual.status,
    'Source tool: '+clean.normalized.sourceTool,
    'Draft artifact: '+(draftArtifact?draftArtifact.draft_id:'none'),
    'send_attempted: false',
    qual.reason,
  ].join('\n');
  return {
    lead_id: raw.lead_id,
    idempotency_key: clean.idempotencyKey,
    source: sourceLabel,
    source_tool: raw.source_tool,
    first_name: clean.normalized.firstName || null,
    last_name: clean.normalized.lastName || null,
    full_name: clean.normalized.fullName || null,
    designation: clean.normalized.designation || null,
    email: clean.normalized.email,
    company: clean.normalized.company,
    company_website: clean.normalized.companyWebsite,
    linkedin_url: clean.normalized.linkedinUrl,
    tool_input: clean.normalized.toolInput,
    tool_output: clean.normalized.toolOutput,
    disposition: disp,
    routing_tier: routed.tier,
    alert_required: routed.alertRequired,
    routing_reason: routed.reason,
    service: scored.service,
    service_fit_primary: qual.primary ? SERVICE_DISPLAY[qual.primary] : null,
    service_fit_secondary: qual.secondary ? SERVICE_DISPLAY[qual.secondary] : null,
    service_fit_reason: qual.reason,
    qualification_method: qual.method,
    qualification_status: qual.status,
    qualification_version: qual.version,
    exclusion_reason: qual.exclusionReason,
    score: scored.score,
    score_reason: scored.scoreReason,
    lead_temperature: routed.tier,
    clean_flags: clean.flags.join(','),
    clean_reasons: clean.reasons.join(' | '),
    draft_status: draftStatus,
    email_subject: emailDraft ? emailDraft.subject : '',
    email_draft: emailDraft ? emailDraft.body : '',
    email_word_count: emailDraft ? emailDraft.wordCount : 0,
    draft_artifact: draftArtifact,
    draft_artifact_id: draftArtifact ? draftArtifact.draft_id : null,
    draft_validation_ok: draftArtifact ? draftArtifact.validation_ok : null,
    send_attempted: false,
    zoho_status: zoho.status,
    zoho_detail: zoho.detail,
    zoho_qualification_summary: zoho_qualification,
    errors: JSON.stringify(errors),
    error_count: errors.length,
    branch: routed.tier,
    human_alert: routed.tier === 'hot' ? 'ALERT: Hot lead requires human review of Zoho draft' : '',
    persistence_target: 'supabase_leads_and_email_draft_artifacts',
    hook_score_100: opts.hookScore100 == null ? null : opts.hookScore100,
    submitted_at: raw.created_at,
    session_id: raw.lead_id,
  };
}

const body = $json.body || $json;
const mapped = makePayloadToRawLead(body);
const processed = processSingleRawLead(mapped.raw, {
  source: 'hook_grader_via_make',
  idempotencyKey: mapped.idempotencyKey,
  hookScore100: mapped.hookScore100,
  byEmail: new Map(),
});
return { json: processed };
