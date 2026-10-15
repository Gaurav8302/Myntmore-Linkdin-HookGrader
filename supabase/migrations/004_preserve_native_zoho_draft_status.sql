-- Preserve native Zoho draft markers when Task 1 retries upsert dry-run placeholders.
CREATE OR REPLACE FUNCTION public.preserve_native_zoho_draft_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.zoho_draft_status IS NOT NULL AND OLD.zoho_draft_status LIKE 'native%'
     AND NEW.zoho_draft_status IN ('dry_run_queued', 'skipped', 'blocked') THEN
    NEW.zoho_draft_status := OLD.zoho_draft_status;
  END IF;
  IF OLD.zoho_lead_id IS NOT NULL AND (NEW.zoho_lead_id IS NULL OR NEW.zoho_lead_id = '') THEN
    NEW.zoho_lead_id := OLD.zoho_lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_native_zoho_draft_status ON public.leads;
CREATE TRIGGER trg_preserve_native_zoho_draft_status
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.preserve_native_zoho_draft_status();
