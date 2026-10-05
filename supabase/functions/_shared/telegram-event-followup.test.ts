import assert from "npm:assert@2.1.0";
import type { TelegramMessage } from "./telegram-community.ts";
const originalServe = Deno.serve;
Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
const webhook = await import("../telegram-community-webhook/index.ts");
Deno.serve = originalServe;
const { detectTelegramEvent, detectEventFollowupIntent, buildEventFollowupAnswer, buildGroupAiQuestion, findEventForFollowup } = webhook;

const ordinaryPost = "Welcome Richard E. Warren, a community speaker who shares ideas about learning and service. Meet Richard via Zoom and register/join our community to explore his work and connect with others.";
const message = (text: string, id = 8): TelegramMessage => ({ message_id: id, date: 1791158400, chat: { id: -1002974118000, type: "supergroup" }, from: { id: 10, is_bot: false, first_name: "Fixture" }, text });
const realAnnouncement = "Workshop invitation: join us via Zoom\nTopic: Learning together\nTime: 19:00 MYT\nDate: 05/10/2026";
const event = (overrides: Record<string, unknown> = {}) => ({ chat_id: -1002974118000, message_id: 1, sender_user_id: null, sender_chat_id: null, event_type: "workshop" as const, title: "Workshop", topic: "Learning together", host_name: null, event_date: "05/10/2026", event_time: "19:00", timezone: "MYT", zoom_link: null, zoom_id: null, zoom_password: null, livestream_links: [], raw_text: realAnnouncement, language: "en", status: "active", created_at: new Date().toISOString(), ...overrides });

Deno.test("ordinary Richard Warren post is not an active event or a Zoom follow-up", () => {
  assert.equal(detectTelegramEvent(message(ordinaryPost)), null);
  assert.equal(detectEventFollowupIntent(ordinaryPost), null);
  const question = buildGroupAiQuestion({ message: message(ordinaryPost), botUsername: "funrich_community_bot", isReplyToBot: false, triggerSource: "admin_message" });
  assert.ok(question.question.includes("Richard E. Warren"));
  assert.equal(detectEventFollowupIntent(question.prompt), null);
});
Deno.test("all event intents require an actual information request in the same clause", () => {
  for (const text of ["Zoom", "The password is shared separately.", "Topic: learning", "Our host welcomes everyone", "Welcome via Zoom, please register/join", "Who is Richard Warren? We welcome him via Zoom.", "Today we join together.", "Time in Malaysia is displayed below."]) assert.equal(detectEventFollowupIntent(text), null, text);
  for (const [text, expected] of [["Zoom link đâu?", "zoom"], ["Cho xin link Zoom", "zoom"], ["Do we have a Zoom link?", "zoom"], ["What is the password?", "password"], ["Cho xin mật khẩu Zoom", "password"], ["Topic hôm nay là gì?", "topic"], ["Who is the host?", "host"], ["Ai hướng dẫn?", "host"], ["Mấy giờ ở Việt Nam?", "time_vi"], ["When does it start?", "time_my"], ["What is the livestream link?", "livestream"]]) assert.equal(detectEventFollowupIntent(text), expected, text);
});
Deno.test("quoted keywords do not turn a new unrelated question into event follow-up", () => {
  for (const text of ['Where can I register?\n> Join via Zoom', 'What do you think of this? “Topic: learning via Zoom”', 'Can you explain the author?\n```\npassword Zoom\n```']) assert.equal(detectEventFollowupIntent(text), null, text);
  const reply = message("What do you think about Richard's work?");
  reply.reply_to_message = message(realAnnouncement, 1);
  const question = buildGroupAiQuestion({ message: reply, botUsername: "funrich_community_bot", isReplyToBot: false, triggerSource: "admin_message" });
  assert.equal(detectEventFollowupIntent(question.prompt), null);
  assert.ok(question.question.includes("background only"));
});
Deno.test("real scheduled Zoom announcement may lack credentials and answer honestly", () => {
  const detected = detectTelegramEvent(message(realAnnouncement));
  assert.ok(detected?.isEvent);
  assert.equal(buildEventFollowupAnswer("zoom", detected!.extracted, "en"), "Angel does not see a Zoom link or ID in this announcement yet.");
  assert.ok(detectTelegramEvent(message("Join Zoom meeting ID: 123 456 789"))?.isEvent);
  assert.equal(detectTelegramEvent(message("Zoom password: welcome; join our community")), null);
});

function database(rows: ReturnType<typeof event>[]) {
  const queries: Array<Array<[string, unknown]>> = [];
  return { queries, from() {
    const filters: Array<[string, unknown]> = []; queries.push(filters);
    const query = { select() { return this; }, eq(k: string, v: unknown) { filters.push([k, v]); return this; }, gte(k: string, v: unknown) { filters.push([k, v]); return this; }, order() { return this; }, limit() { return this; }, maybeSingle() { return Promise.resolve({ data: result()[0] ?? null, error: null }); }, then(resolve: (v: unknown) => void) { resolve({ data: result(), error: null }); } };
    const result = () => rows.filter(row => filters.filter(([k]) => k !== "created_at").every(([k,v]) => row[k as keyof typeof row] === v));
    return query;
  } };
}
Deno.test("event selection honors direct replies without falling back to unrelated events", async () => {
  const db = database([event()]);
  assert.equal(await findEventForFollowup(db as never, -1002974118000, 999), null);
  const old = event({ created_at: "2020-01-01T00:00:00Z" });
  assert.equal((await findEventForFollowup(database([old]) as never, -1002974118000, 1))?.message_id, 1);
  assert.equal(await findEventForFollowup(database([old]) as never, -1002974118000), null);
});
Deno.test("implicit event lookup rejects weak records, ambiguity and other groups", async () => {
  const weak = event({ message_id: 2, topic: null, event_time: null, event_date: null, raw_text: ordinaryPost });
  assert.equal(await findEventForFollowup(database([weak]) as never, -1002974118000), null);
  assert.equal(await findEventForFollowup(database([event(), event({ message_id: 3 })]) as never, -1002974118000), null);
  assert.equal(await findEventForFollowup(database([event()]) as never, -1001649798056), null);
  assert.equal((await findEventForFollowup(database([event()]) as never, -1002974118000))?.message_id, 1);
});
Deno.test("specific information requests take precedence over a Zoom mention", () => {
  for (const [text, expected] of [["What is the Zoom topic?", "topic"], ["Who is the Zoom host?", "host"], ["What time is the Zoom meeting in Malaysia?", "time_my"], ["Zoom bắt đầu lúc mấy giờ ở Việt Nam?", "time_vi"]]) assert.equal(detectEventFollowupIntent(text), expected);
});
Deno.test("Telegram quote entities and reply.quote are background, not new questions", () => {
  const authored = message("What do you think?\nZoom password topic host");
  authored.entities = [{ type: "blockquote", offset: 19, length: 24 }];
  assert.equal(detectEventFollowupIntent(webhook.eventFollowupSenderText(authored)), null);
  const captioned = { ...message(""), text: undefined, caption: "🌸 What do you think?\nWhere is the Zoom link?", caption_entities: [{ type: "expandable_blockquote", offset: 21, length: 23 }] };
  assert.equal(detectEventFollowupIntent(webhook.eventFollowupSenderText(captioned)), null);
  const direct = message("What do you think?");
  direct.quote = { text: "Where is the Zoom link?" };
  direct.reply_to_message = message(realAnnouncement, 1);
  assert.equal(detectEventFollowupIntent(webhook.eventFollowupSenderText(direct)), null);
});
Deno.test("lookup errors and unrelated event modalities never manufacture a follow-up", async () => {
  const failure = { from() { return { select() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: null, error: { code: "fixture-only" } }); }, maybeSingle() { return Promise.resolve({ data: null, error: { code: "fixture-only" } }); } }; } };
  assert.equal(await findEventForFollowup(failure as never, -1002974118000), null);
  assert.equal(await findEventForFollowup(failure as never, -1002974118000, 1), null);
  const live = event({ raw_text: "Join our livestream live broadcast", zoom_link: null, zoom_id: null, livestream_links: ["https://youtube.com/live/fixture"] });
  assert.equal(await findEventForFollowup(database([live]) as never, -1002974118000, 1, "zoom"), null);
});
Deno.test("event keywords in opinion or author questions remain ordinary AI content", () => {
  for (const text of ["What do you think of Richard welcoming guests via Zoom?", "Why does Richard use Zoom?", "What is Zoom?", "What do you think of the Zoom link?", "What do you think about the host?", "What do you think of today's topic?"]) assert.equal(detectEventFollowupIntent(text), null, text);
});
Deno.test("short Vietnamese requests retain intent and linked labels remain authored text", () => {
  for (const [text, intent] of [["Chủ đề hôm nay?", "topic"], ["Ai là người hướng dẫn?", "host"], ["Mật khẩu Zoom là bao nhiêu?", "password"], ["Zoom ở đâu?", "zoom"], ["Can you send the Zoom details?", "zoom"]]) assert.equal(detectEventFollowupIntent(text), intent, text);
  const linked = message("Where is the Zoom link?");
  linked.entities = [{ type: "text_link", offset: 13, length: 4, url: "https://fixture.invalid/zoom" }];
  assert.equal(detectEventFollowupIntent(webhook.eventFollowupSenderText(linked)), "zoom");
  const targetOnly = message("What do you think of this author?");
  targetOnly.entities = [{ type: "text_link", offset: 25, length: 6, url: "https://fixture.invalid/zoom" }];
  assert.equal(detectEventFollowupIntent(webhook.eventFollowupSenderText(targetOnly)), null);
});
Deno.test("Zoom knowledge questions are distinct from requests to send event access", () => {
  assert.equal(detectEventFollowupIntent("How does Richard share his work via Zoom?"), null);
  assert.equal(detectEventFollowupIntent("Can you send the Zoom details?"), "zoom");
  assert.equal(detectEventFollowupIntent("Send me the Zoom link"), "zoom");
});
