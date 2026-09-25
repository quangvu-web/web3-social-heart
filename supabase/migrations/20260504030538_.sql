-- 1) profiles: remove anon read access (keeps authenticated read)
DROP POLICY IF EXISTS "Anon can view basic profile info" ON public.profiles;

-- 2) account_merge_requests: drop user-by-email read access (admin + service_role only remain)
DROP POLICY IF EXISTS "Users can view their own merge requests" ON public.account_merge_requests;

-- 3) Lock down internal/RLS-enabled tables that have no policies
CREATE POLICY "deny_all_select" ON public.rate_limit_state FOR SELECT USING (false);
CREATE POLICY "deny_all_modify" ON public.rate_limit_state FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_select" ON public.wallet_auth_attempts FOR SELECT USING (false);
CREATE POLICY "deny_all_modify" ON public.wallet_auth_attempts FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_select" ON public.email_link_otps FOR SELECT USING (false);
CREATE POLICY "deny_all_modify" ON public.email_link_otps FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_select" ON public.siwe_nonces FOR SELECT USING (false);
CREATE POLICY "deny_all_modify" ON public.siwe_nonces FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_select" ON public.wallet_rate_limits FOR SELECT USING (false);
CREATE POLICY "deny_all_modify" ON public.wallet_rate_limits FOR ALL USING (false) WITH CHECK (false);;
