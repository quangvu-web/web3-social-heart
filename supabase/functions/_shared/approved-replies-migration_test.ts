import { PGlite } from "npm:@electric-sql/pglite@0.5.15";
import assert from "npm:assert@2.1.0";

// Isolated PostgreSQL; auth helpers below are fixtures, never production changes.
Deno.test("approved library migration enforces review lifecycle, CAS and role isolation", async () => {
  const db = new PGlite();
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='00000000-0000-0000-0000-000000000001'::uuid AND $2='admin' $$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
`,
  );
  await db.exec(
    Deno.readTextFileSync(
      new URL(
        "../../migrations/20261108000000_approved_telegram_replies.sql",
        import.meta.url,
      ),
    ),
  );
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`,
  );
  type DbRow = {
    id: string;
    status: string;
    match_keys: string[];
    approved_by: string | null;
    revision: number;
  };
  const q = async (sql: string, args: unknown[] = []) =>
    (await db.query<DbRow>(sql, args)).rows;
  const [draft] = await q(
    `INSERT INTO public.telegram_approved_replies(question,aliases,answer,language,group_id,status) VALUES ($1,$2,$3,'vi',-1001,'approved') RETURNING *`,
    ["CAMLY là gì?!", ["Giới thiệu CAMLY"], "Nội dung đã kiểm chứng."],
  );
  assert.equal(draft.status, "draft");
  assert.deepEqual(draft.match_keys, ["camly là gì", "giới thiệu camly"]);
  let [approved] = await q(
    `UPDATE public.telegram_approved_replies SET status='approved' WHERE id=$1 AND revision=$2 RETURNING *`,
    [draft.id, draft.revision],
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.approved_by, "00000000-0000-0000-0000-000000000001");
  let [edited] = await q(
    `UPDATE public.telegram_approved_replies SET answer='Nội dung mới',status='approved' WHERE id=$1 AND revision=$2 RETURNING *`,
    [draft.id, approved.revision],
  );
  assert.equal(edited.status, "draft");
  assert.equal(edited.approved_by, null);
  assert.equal(edited.revision, approved.revision + 1);
  assert.equal(
    (await q(
      `UPDATE public.telegram_approved_replies SET status='approved' WHERE id=$1 AND revision=$2 RETURNING id`,
      [draft.id, approved.revision],
    )).length,
    0,
  );
  await q(
    `UPDATE public.telegram_approved_replies SET status='approved' WHERE id=$1`,
    [draft.id],
  );
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`,
  );
  assert.equal(
    (await q(`SELECT * FROM public.telegram_approved_replies`)).length,
    0,
  );
  assert.equal(
    (await q(
      `UPDATE public.telegram_approved_replies SET status='revoked' RETURNING id`,
    )).length,
    0,
  );
  await assert.rejects(
    () =>
      q(`INSERT INTO public.telegram_approved_replies(question,answer,language) VALUES ('CAMLY là gì','Invalid','vi')`),
    /row-level security/,
  );
  await db.exec(`RESET ROLE; SET ROLE anon;`);
  await assert.rejects(
    () => q(`SELECT * FROM public.telegram_approved_replies`),
    /permission denied/,
  );
  await db.exec(`RESET ROLE; SET ROLE service_role;`);
  assert.equal(
    (await q(
      `SELECT * FROM public.telegram_approved_replies WHERE status='approved' AND match_keys @> ARRAY['camly là gì']`,
    )).length,
    1,
  );
  await db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`,
  );
  await q(
    `UPDATE public.telegram_approved_replies SET status='revoked' WHERE id=$1`,
    [draft.id],
  );
  assert.equal(
    (await q(
      `SELECT * FROM public.telegram_approved_replies WHERE status='approved'`,
    )).length,
    0,
  );
  await q(
    `UPDATE public.telegram_approved_replies SET expires_at=now()-interval '1 day' WHERE id=$1`,
    [draft.id],
  );
  await assert.rejects(
    () =>
      q(
        `UPDATE public.telegram_approved_replies SET status='approved' WHERE id=$1`,
        [draft.id],
      ),
    /future expiry/,
  );

  await db.close();
});
