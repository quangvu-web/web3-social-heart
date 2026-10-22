import assert from "npm:assert@2.1.0";
import { isCaptionOperator } from "./caption-operators.ts";

function fixture(ids: unknown, error: unknown = null, throws = false) {
  const query = {
    select: () => query, order: () => query, limit: () => query,
    maybeSingle: () => {
      if (throws) throw new Error("fixture");
      return Promise.resolve({ data: { caption_operator_ids: ids }, error });
    },
  };
  return { from: () => query };
}

Deno.test("initial Telegram operator 5373909526 is allowed", async () => {
  assert.equal(await isCaptionOperator(fixture([5373909526]), 5373909526), true);
});
Deno.test("non-operator Telegram user 5938169315 is denied", async () => {
  assert.equal(await isCaptionOperator(fixture([5373909526]), 5938169315), false);
});
Deno.test("empty operator list denies everyone", async () => {
  assert.equal(await isCaptionOperator(fixture([]), 5373909526), false);
});
Deno.test("NULL operator list denies everyone", async () => {
  assert.equal(await isCaptionOperator(fixture(null), 5373909526), false);
});
Deno.test("settings read errors deny even a listed operator", async () => {
  assert.equal(await isCaptionOperator(fixture([5373909526], { message: "fixture" }), 5373909526), false);
});
Deno.test("settings exception denies even a listed operator", async () => {
  assert.equal(await isCaptionOperator(fixture([5373909526], null, true), 5373909526), false);
});
Deno.test("operator changes take effect without a cached authorization", async () => {
  const ids = [5373909526];
  const client = fixture(ids);
  assert.equal(await isCaptionOperator(client, 5373909526), true);
  ids.length = 0;
  assert.equal(await isCaptionOperator(client, 5373909526), false);
});