import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContextBridgedQuery, extractLastAssistantQuestion, extractSubjectFromQuestion, hasUnresolvedReference, isConfirmationOnly, isMixedConfirmationTurn, shouldBridge } from "./angel-context-bridge.ts";

Deno.test("subject extractor: a16z suggestion — không được chọn 'Angel'", () => {
  const q = "Bé có muốn Angel chia sẻ thêm về những lĩnh vực cụ thể mà a16z thường tập trung hay cách họ hỗ trợ các startup không?";
  const subject = extractSubjectFromQuestion(q);
  assertEquals(subject, "a16z");
});

Deno.test("subject extractor: 'Bé muốn Angel kể thêm về Fun Cosmos không?' → Fun Cosmos", () => {
  const q = "Bé muốn Angel kể thêm về Fun Cosmos không?";
  const subject = extractSubjectFromQuestion(q);
  assertEquals(subject, "Fun Cosmos");
});

Deno.test("subject extractor: câu không có tên riêng → noun-phrase, không phải 'Angel'", () => {
  const q = "Bé có muốn Angel chia sẻ thêm về những trải nghiệm ánh sáng gần đây không?";
  const subject = extractSubjectFromQuestion(q);
  assertEquals(subject !== null, true);
  assertEquals(/^angel$/i.test(subject ?? ""), false);
  assertStringIncludes(subject ?? "", "trải nghiệm");
});

Deno.test("bridge a16z: 'Dạ có' phải bám a16z, không được rơi vào self-reference 'Angel'", () => {
  const history = [
    { role: "assistant", content: "a16z (Andreessen Horowitz) là quỹ đầu tư công nghệ hàng đầu, nổi tiếng với triết lý 'software is eating the world'. Bé có muốn Angel chia sẻ thêm về những lĩnh vực cụ thể mà a16z thường tập trung hay cách họ hỗ trợ các startup không?" },
  ];
  const bridged = buildContextBridgedQuery("Dạ có", history);
  assertStringIncludes(bridged ?? "", "a16z");
  // Không được xưng subject là "Angel"
  assertEquals(/Chủ đề bé đang xác nhận muốn nghe tiếp là:\s*\*\*Angel\*\*/i.test(bridged ?? ""), false);
});



Deno.test("confirmation bridge: 'Bé muốn' is detected", () => {
  assertEquals(isConfirmationOnly("Bé muốn"), true);
  assertEquals(isConfirmationOnly("Dạ bé muốn nghe thêm ạ"), true);
});

Deno.test("confirmation bridge: uses latest assistant question, not older topic", () => {
  const history = [
    { role: "assistant", content: "Lòng trắc ẩn giúp bé mở rộng trái tim. Bé muốn Angel chia sẻ thêm cách nuôi dưỡng lòng trắc ẩn không?" },
    { role: "user", content: "Dạ bé muốn" },
    { role: "assistant", content: "FUN Ecosystem gồm nhiều platform bổ trợ nhau. Bé muốn Angel chia sẻ sâu hơn về vai trò của bất kỳ platform nào trong đó không?" },
  ];

  const question = extractLastAssistantQuestion(history);
  assertStringIncludes(question ?? "", "FUN Ecosystem");

  const bridged = buildContextBridgedQuery("Bé muốn", history);
  assertStringIncludes(bridged ?? "", "FUN Ecosystem");
  assertEquals((bridged ?? "").includes("lòng trắc ẩn"), false);
});

Deno.test("confirmation bridge: direct reply context can bypass stale DB history", () => {
  const immediateContext = [
    { role: "assistant", content: "FUN Ecosystem gồm nhiều platform bổ trợ nhau. Bé muốn Angel chia sẻ sâu hơn về vai trò của bất kỳ platform nào trong đó không?" },
  ];

  const bridged = buildContextBridgedQuery("Bé muốn", immediateContext);
  assertStringIncludes(bridged ?? "", "FUN Ecosystem");
});

Deno.test("confirmation bridge: negation is not bridged", () => {
  assertEquals(isConfirmationOnly("Bé không muốn"), false);
});

Deno.test("confirmation bridge: skips emoji-only / trivial assistant turns", () => {
  const history = [
    { role: "assistant", content: "Bé có muốn Angel chia sẻ thêm về PLP (Photon Light Platform) không?" },
    { role: "user", content: "..." },
    { role: "assistant", content: "✨" },
  ];
  const q = extractLastAssistantQuestion(history);
  assertStringIncludes(q ?? "", "PLP");
  const bridged = buildContextBridgedQuery("Dạ có", history);
  assertStringIncludes(bridged ?? "", "PLP");
});

Deno.test("confirmation bridge: skips meta-question 'nhắc lại câu hỏi cụ thể'", () => {
  const history = [
    { role: "assistant", content: "PureLove Protocol có 5 trụ cột cốt lõi giúp đo lường đóng góp thật. Bé có muốn Angel giải thích kỹ hơn về một trong 5 trụ cột đó không?" },
    { role: "user", content: "Dạ có" },
    { role: "assistant", content: "Để Angel có thể chia sẻ thật đúng trọng tâm và chi tiết theo mong muốn của bé, bé có thể nhắc lại câu hỏi cụ thể mà Angel đã đặt ở lượt trước không?" },
  ];
  const q = extractLastAssistantQuestion(history);
  assertStringIncludes(q ?? "", "5 trụ cột");
  const bridged = buildContextBridgedQuery("Dạ có", history);
  assertStringIncludes(bridged ?? "", "5 trụ cột");
});

Deno.test("mixed confirmation: 'Dạ bé muốn, dự án nổi bật của họ là gì' resolves subject a16z", () => {
  const history = [
    { role: "assistant", content: "a16z là quỹ đầu tư công nghệ hàng đầu. Bé muốn Angel chia sẻ thêm về lĩnh vực đầu tư cụ thể hay các dự án nổi bật của a16z không?" },
  ];
  assertEquals(isMixedConfirmationTurn("Dạ bé muốn, dự án nổi bật của họ là gì"), true);
  assertEquals(shouldBridge("Dạ bé muốn, dự án nổi bật của họ là gì"), true);
  const bridged = buildContextBridgedQuery("Dạ bé muốn, dự án nổi bật của họ là gì", history);
  assertStringIncludes(bridged ?? "", "a16z");
  assertStringIncludes(bridged ?? "", "dự án nổi bật của họ là gì");
});

Deno.test("unresolved reference: 'Cái đó hoạt động thế nào?' after PLP explanation → bridges to PLP", () => {
  const history = [
    { role: "assistant", content: "PLP là gì? PLP (PureLove Protocol) là giao thức đo lường đóng góp thật, hoạt động dựa trên 5 trụ cột cốt lõi của PLP." },
  ];
  assertEquals(hasUnresolvedReference("Cái đó hoạt động thế nào?"), true);
  const bridged = buildContextBridgedQuery("Cái đó hoạt động thế nào?", history);
  assertStringIncludes(bridged ?? "", "PLP");
});

Deno.test("mixed confirmation: negation is not bridged", () => {
  assertEquals(isMixedConfirmationTurn("Bé không muốn, kể chuyện khác đi"), false);
  assertEquals(shouldBridge("Bé không muốn, kể chuyện khác đi"), false);
});

Deno.test("unresolved reference: câu đã có danh từ riêng thì KHÔNG bridge", () => {
  assertEquals(hasUnresolvedReference("Bitcoin hoạt động như thế nào?"), false);
});

Deno.test("common-noun subject: Fun Cosmos slide → 'Dạ bé muốn' bám cấu trúc từng trang", () => {
  const history = [
    { role: "assistant", content: "Slide deck Fun Cosmos gồm 12 trang giới thiệu về hệ sinh thái. Bé muốn Angel gợi ý thêm về cấu trúc từng trang cụ thể không?" },
  ];
  const q = extractLastAssistantQuestion(history);
  assertStringIncludes(q ?? "", "cấu trúc từng trang");
  const bridged = buildContextBridgedQuery("Dạ bé muốn", history);
  assertStringIncludes(bridged ?? "", "cấu trúc từng trang");
  // Không được nhảy sang chủ đề khác (trí tuệ/PLP/lòng trắc ẩn).
  assertEquals((bridged ?? "").toLowerCase().includes("trí tuệ"), false);
  assertEquals((bridged ?? "").toLowerCase().includes("plp"), false);
});

Deno.test("common-noun subject: '5 trụ cột' cũng được extract làm subject", () => {
  const history = [
    { role: "assistant", content: "PureLove Protocol có 5 trụ cột cốt lõi. Bé có muốn Angel giải thích kỹ hơn về một trong 5 trụ cột đó không?" },
  ];
  const bridged = buildContextBridgedQuery("Dạ có", history);
  assertStringIncludes(bridged ?? "", "5 trụ cột");
});
