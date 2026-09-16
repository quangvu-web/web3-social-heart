import { resolveAngelLanguageBucket, angelLanguageDirective, replyViolatesAngelLanguageBucket } from "./_shared/telegram-community.ts";

for (const msg of ["i need help", "I need help", "Can you help me with FUN Profile?", "Angel oi giup be", "Angel ơi giúp bé", "What is the password?", "PW là gì?"]) {
  const b = resolveAngelLanguageBucket(msg);
  console.log(JSON.stringify(msg), "->", b);
}
console.log("---violation checks---");
console.log("EN reply in VI?", replyViolatesAngelLanguageBucket("Angel giúp bé nhé", "en"));
console.log("VI reply in EN?", replyViolatesAngelLanguageBucket("Sure, I can help you.", "vi"));
