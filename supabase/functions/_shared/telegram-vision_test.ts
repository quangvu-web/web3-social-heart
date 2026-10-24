import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
const source = await Deno.readTextFile(
  new URL("./telegram-community.ts", import.meta.url),
);
const helper = source.slice(
  source.indexOf("// Vision describe qua"),
  source.indexOf("export { runOcrOnPhoto"),
);
let serial = 0;
async function fixture(shared = new Map<string, any>()) {
  const code = ts.transpileModule(
    `
    let enabled=true, mediaOk=true, modelOk=true, key=true, empty=false;
    export function configure(v){if('enabled'in v)enabled=v.enabled;if('mediaOk'in v)mediaOk=v.mediaOk;if('modelOk'in v)modelOk=v.modelOk;if('key'in v)key=v.key;if('empty'in v)empty=v.empty;}
    export const calls=[];
    export const outcomes=[];
    async function getFlag(){return enabled;}
    const Deno={env:{get:(k)=>k==='LOVABLE_API_KEY'&&key?'fixture':undefined}};
    function pickLargestPhotoFileId(m){const p=m.photo?.reduce((a,b)=>(a.file_size??a.width*a.height)>(b.file_size??b.width*b.height)?a:b);return p?{fileId:p.file_id,uniq:p.file_unique_id}:null;}
    async function tryFetchTelegramMedia(id){calls.push({kind:'fetch',id});return mediaOk?{dataUrl:'data:image/png;base64,fixture'}:null;}
    async function callAiGateway(body){calls.push({kind:'model',body});return {ok:modelOk,status:modelOk?200:503,text:empty?'':'Nền trắng. FUN Profile. Hẹn gặp lúc 19:00 MYT.'};}
    function gatewayText(result){return result.text;}
    async function sha256Hex(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
    function getClients(){return {adminClient:globalThis.__visionCacheFixture};}
    ${helper}
  `,
    {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const admin = {
    from() {
      let scope = "", key = "";
      const q = {
        select() {
          return q;
        },
        eq(k: string, v: any) {
          if (k === "group_id") scope = v;
          if (k === "cache_key") key = v;
          return q;
        },
        gt() {
          return q;
        },
        maybeSingle() {
          const row = shared.get(scope + "|" + key);
          return Promise.resolve({
            data: row && Date.parse(row.expires_at) > Date.now() ? row : null,
            error: null,
          });
        },
        upsert(row: any) {
          shared.set(row.group_id + "|" + row.cache_key, row);
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  };
  (globalThis as any).__visionCacheFixture = admin;
  const mod = await import(
    `data:application/javascript,${
      encodeURIComponent(code + "\n//fixture" + serial++)
    }`
  );
  return { ...mod, shared };
}
const photo = {
  chat: { id: 123, type: "private" },
  message_id: 1,
  photo: [{ file_id: "small", file_unique_id: "small-u", file_size: 10 }, {
    file_id: "large",
    file_unique_id: "large-u",
    file_size: 100,
  }],
};
Deno.test("vision selects one largest image and cache survives new worker/caption for 30 minutes", async () => {
  const first = await fixture();
  const desc = await first.describeTelegramImage(
    photo,
    "Soạn tin nhắn trả lời",
  );
  assert.ok(desc?.includes("19:00"));
  assert.deepEqual(
    first.calls.filter((c: any) => c.kind === "fetch").map((c: any) => c.id),
    ["large"],
  );
  const second = await fixture(first.shared);
  assert.equal(await second.describeTelegramImage(photo, ""), desc);
  assert.equal(
    second.calls.length,
    0,
    "new worker must hit persistent description cache",
  );
  await second.describeTelegramImage({
    ...photo,
    chat: { id: 456, type: "private" },
  }, "");
  assert.equal(
    second.calls.filter((c: any) => c.kind === "model").length,
    1,
    "same image in another DM must not reuse private cache",
  );
});
Deno.test("flag off, failed media/model and empty model return null with explicit safe outcome", async () => {
  for (
    const [config, reason] of [
      [{ enabled: false }, "flag_disabled"],
      [{ mediaOk: false }, "fetch_failed"],
      [{ modelOk: false }, "model_failed"],
      [{ empty: true }, "model_empty"],
      [{ key: false }, "missing_api_key"],
    ] as const
  ) {
    const f = await fixture();
    f.configure(config);
    const events: any[] = [];
    assert.equal(
      await f.describeTelegramImage(photo, "", {
        onOutcome: (e: any) => events.push(e),
      }),
      null,
    );
    assert.equal(events.at(-1)?.reason, reason);
  }
});
Deno.test("disabled flag suppresses cached result, concurrent same-worker reads share one call, expired cache refreshes", async () => {
  const f = await fixture();
  await Promise.all([
    f.describeTelegramImage(photo, ""),
    f.describeTelegramImage(photo, ""),
  ]);
  assert.equal(f.calls.filter((c: any) => c.kind === "model").length, 1);
  f.configure({ enabled: false });
  assert.equal(await f.describeTelegramImage(photo, ""), null);
  for (const row of f.shared.values()) {
    row.expires_at = new Date(0).toISOString();
  }
  const fresh = await fixture(f.shared);
  await fresh.describeTelegramImage(photo, "");
  assert.equal(fresh.calls.filter((c: any) => c.kind === "model").length, 1);
});
Deno.test("context keeps actual image, user request and no-false-blindness directive", async () => {
  const f = await fixture();
  const context = f.buildImageAnalysisContext(
    "FUN Profile, 19:00 MYT",
    "Soạn tin nhắn trả lời cho tin nhắn hình này nhé Angel",
  );
  assert.ok(context.includes("19:00 MYT"));
  assert.ok(context.includes("TUYỆT ĐỐI KHÔNG"));
  assert.ok(context.includes("Soạn tin nhắn trả lời"));
  assert.ok(context.includes("có thể gửi ngay"));
  assert.ok(
    f.buildImageAnalysisContext("Ảnh mẫu", "").includes(
      "hỏi bé muốn Angel làm gì",
    ),
  );
});

Deno.test("persistent cache supports group and supergroup scopes without sharing across chats", async () => {
  for (const type of ["group", "supergroup"]) {
    const first = await fixture();
    const groupPhoto = { ...photo, chat: { id: -1001, type } };
    const description = await first.describeTelegramImage(
      groupPhoto,
      "Ảnh có gì?",
    );
    const fresh = await fixture(first.shared);
    assert.equal(
      await fresh.describeTelegramImage(groupPhoto, "Caption mới"),
      description,
    );
    assert.equal(
      fresh.calls.length,
      0,
      "new worker must reuse group persistent cache",
    );
    await fresh.describeTelegramImage({
      ...groupPhoto,
      chat: { id: -1002, type },
    }, "");
    assert.equal(fresh.calls.filter((c: any) => c.kind === "model").length, 1);
  }
});
