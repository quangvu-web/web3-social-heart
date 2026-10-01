import {
  deleteFromAngelKnowledge,
  getAngelKnowledgeStatus,
  pushToAngelKnowledge,
} from "./angel-knowledge.ts";

const BOT_KEY = "ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT";
const INGEST_KEY = "ANGEL_KNOWLEDGE_INGEST_KEY";
const LEGACY_KEY = "ANGEL_AI_API_KEY";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Chỉ dùng giá trị giả và fetch giả; không đọc secret hay gọi backend thật.
async function withMocks(
  env: Record<string, string | undefined>,
  status: number,
  run: (calls: Array<{ key: string | null; action: string }>) => Promise<void>,
) {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ key: string | null; action: string }> = [];
  Deno.env.get = (name: string) => env[name];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({
      key: new Headers(init?.headers).get("x-api-key"),
      action: body.action,
    });
    return new Response(
      JSON.stringify({
        items: [{ source_ref: "test-ref" }],
        results: [{ source_ref: "test-ref", status: "persisted" }],
      }),
      { status },
    );
  };
  try {
    await run(calls);
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
  }
}

async function runActions() {
  return await Promise.all([
    pushToAngelKnowledge({
      source: "fun_profile",
      source_ref: "test-ref",
      title: "Test",
      content: "Test content",
    }, { verify: true }),
    deleteFromAngelKnowledge("telegram_channel", "test-ref"),
    getAngelKnowledgeStatus("telegram_channel", ["test-ref"]),
  ]);
}

for (
  const scenario of [
    {
      name: "ưu tiên khóa bot",
      env: {
        [BOT_KEY]: "test-bot",
        [INGEST_KEY]: "test-ingest",
        [LEGACY_KEY]: "test-legacy",
      },
      expected: "test-bot",
    },
    {
      name: "dùng khóa ingest khi thiếu khóa bot",
      env: { [INGEST_KEY]: "test-ingest", [LEGACY_KEY]: "test-legacy" },
      expected: "test-ingest",
    },
    {
      name: "tương thích khóa cũ",
      env: { [LEGACY_KEY]: "test-legacy" },
      expected: "test-legacy",
    },
    {
      name: "bỏ qua khóa bot rỗng",
      env: { [BOT_KEY]: "", [INGEST_KEY]: "test-ingest" },
      expected: "test-ingest",
    },
  ]
) {
  Deno.test(`angel knowledge: ${scenario.name}`, async () => {
    await withMocks(scenario.env, 200, async (calls) => {
      const results = await runActions();
      assert(
        results.every((result) => result.ok),
        "Các action phải thành công",
      );
      assert(
        calls.length === 4,
        "Phải gọi upsert, delete, status và status xác minh",
      );
      assert(
        calls.every((call) => call.key === scenario.expected),
        "Mọi action phải dùng đúng khóa",
      );
      assert(
        calls.filter((call) => call.action === "status").length === 2,
        "Phải xác minh lưu bằng status",
      );
    });
  });
}

Deno.test("angel knowledge: thiếu mọi khóa thì skip, không gửi request", async () => {
  await withMocks({}, 200, async (calls) => {
    const results = await runActions();
    assert(
      results.every((result) => !result.ok && result.skipped),
      "Phải trả skipped",
    );
    assert(
      results.every((result) =>
        result.error === "Angel knowledge ingest key not configured"
      ),
      "Thông báo phải nhất quán",
    );
    assert(calls.length === 0, "Không được gửi request khi thiếu khóa");
  });
});

for (const status of [401, 403]) {
  Deno.test(`angel knowledge: HTTP ${status} không tự chuyển sang khóa khác`, async () => {
    await withMocks(
      {
        [BOT_KEY]: "test-bot",
        [INGEST_KEY]: "test-ingest",
        [LEGACY_KEY]: "test-legacy",
      },
      status,
      async (calls) => {
        const results = await runActions();
        assert(
          results.every((result) =>
            !result.ok && result.error?.includes(`HTTP ${status}`)
          ),
          "Phải trả lỗi từ chối khóa",
        );
        assert(
          calls.length === 3,
          "Không được retry bằng khóa khác hoặc xác minh upsert thất bại",
        );
        assert(
          calls.every((call) => call.key === "test-bot"),
          "Không được đổi danh tính kết nối",
        );
      },
    );
  });
}
