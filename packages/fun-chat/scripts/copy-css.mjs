import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../src/styles/fun-chat.css');
const out = resolve(__dirname, '../dist/styles.css');
mkdirSync(dirname(out), { recursive: true });
copyFileSync(src, out);