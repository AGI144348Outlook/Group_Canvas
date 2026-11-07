// Private, read-only search for a profile-assessment conversation with usage statistics.
// Never logs titles, IDs, text or credentials. Writes nothing to R2 or the cabinet.
// Output: summary counts (public) + candidate report encrypted to a session-held recipient cert.
import {createHash} from 'node:crypto';
import {open, writeFile, mkdir, rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {conversationRecords} from '../../public/tower/archive-parser.js';
import {scoreConversation, excerpt, openingPaths, PATTERNS} from './match.mjs';
import {contentText} from '../../public/tower/archive-parser.js';

const key = process.env.CREATE_ROOM_KEY;
if (!key) throw Error('Existing storage credential required');
const origin = 'https://group-canvas-tower.agi144348.workers.dev', directory = '/tmp/private-profile-recovery';
const sha = b => createHash('sha256').update(b).digest('hex');
// GET-only access to the existing cabinet API (list, status, download ticket).
async function api(path, method = 'GET') {
  if (method !== 'GET' && !path.endsWith('/ticket')) throw Error('Read-only runner refused a write');
  const r = await fetch(origin + '/api/files' + path, {method, headers: {'x-filing-key': key}, signal: AbortSignal.timeout(180000)});
  if (!r.ok) throw Error('Private cabinet HTTP ' + r.status);
  return r.json();
}
async function download(id, path) {
  const ticket = await api('/files/' + id + '/ticket', 'POST');
  const r = await fetch(origin + ticket.path, {signal: AbortSignal.timeout(180000)});
  if (!r.ok) throw Error('Private download failed');
  await pipeline(r.body, createWriteStream(path, {mode: 0o600}));
}
async function inventory() {
  const files = []; let after;
  for (let n = 0; n < 100; n++) { const r = await api('/files' + (after ? '?after=' + encodeURIComponent(after) : '')); files.push(...r.files); after = r.next; if (!after) return files; }
  throw Error('Inventory budget exceeded');
}

await mkdir(directory, {recursive: true, mode: 0o700});
try {
  const files = await inventory(), sources = files.filter(f => /^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source.name));
  const seenSource = new Set(), bestByConversation = new Map(), pending = [];
  let read = 0, duplicates = 0, occurrences = 0, scored = 0, parseErrors = 0;
  const shape = {withMapping: 0, withMessagesArray: 0, otherShape: 0, topKeys: {}, visibleTurns: 0, assistantTurns: 0, branchPaths: 0, rootsPerConversation: {}, openingHits: {}, anywhereHits: {}, roles: {}, contentTypes: {}, partTypes: {}};
  const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const inspect = c => {
    if (c && typeof c.mapping === 'object' && c.mapping) shape.withMapping++; else if (Array.isArray(c?.messages) || Array.isArray(c?.chat_messages)) shape.withMessagesArray++; else shape.otherShape++;
    for (const k of Object.keys(c || {})) if (/^[a-z_]{1,32}$/.test(k)) tally(shape.topKeys, k);
    const map = c?.mapping || {}; tally(shape.rootsPerConversation, String(Object.values(map).filter(n => !n.parent || !map[n.parent]).length));
    const paths = openingPaths(c); shape.branchPaths += paths.length;
    for (const path of paths) for (const m of path) { shape.visibleTurns++; if (m.role === 'assistant') { shape.assistantTurns++; for (const [g, ps] of Object.entries(PATTERNS)) ps.forEach((re, i) => { if (re.test(m.text)) tally(shape.openingHits, g + i); }); } }
    for (const n of Object.values(map)) { const m = n?.message; if (m?.author?.role === 'assistant') { const t = contentText(m).text; for (const [g, ps] of Object.entries(PATTERNS)) ps.forEach((re, i) => { if (re.test(t)) tally(shape.anywhereHits, g + i); }); } }
    for (const n of Object.values(c?.mapping || {})) { const m = n?.message; if (!m) continue; tally(shape.roles, String(m.author?.role)); tally(shape.contentTypes, String(m.content?.content_type)); for (const part of m.content?.parts || []) tally(shape.partTypes, typeof part); }
  };
  for (const file of sources) {
    const status = await api('/files/' + file.id + '/status');
    if (status.status !== 'complete') { pending.push(status.status); continue; }
    const path = directory + '/source.json'; await download(file.id, path);
    const handle = await open(path, 'r'), stat = await handle.stat();
    if (stat.size !== file.source.size) throw Error('Source size mismatch');
    const hash = createHash('sha256'); for await (const b of handle.createReadStream({autoClose: false, start: 0})) hash.update(b);
    const checksum = hash.digest('hex');
    if (seenSource.has(checksum)) { duplicates++; await handle.close(); await rm(path); continue; }
    seenSource.add(checksum); read++;
    const view = {size: stat.size, slice: (start, end) => ({arrayBuffer: async () => { const b = Buffer.alloc(end - start), r = await handle.read(b, 0, b.length, start); return b.buffer.slice(b.byteOffset, b.byteOffset + r.bytesRead); }})};
    let ordinal = 0;
    try {
      for await (const record of conversationRecords(view)) {
        ordinal++;
        const c = record.value; inspect(c); const hit = scoreConversation(c);
        if (!hit) continue;
        scored++;
        const id = c.conversation_id || c.id || 'no-id:' + sha(record.raw).slice(0, 16);
        const entry = {
          score: hit.score, usageHits: hit.usageHits, profileHits: hit.profileHits, promptHits: hit.promptHits, branches: hit.branches,
          conversationId: id, title: c.title ?? null, createTime: c.create_time ?? null, updateTime: c.update_time ?? null,
          link: c.conversation_id || c.id ? 'https://chatgpt.com/c/' + (c.conversation_id || c.id) : null,
          firstUser: {nodeId: hit.firstUser.id, time: hit.firstUser.time, excerpt: hit.firstUser.text.slice(0, 600)},
          reply: {nodeId: hit.reply.id, parentId: hit.reply.parent, time: hit.reply.time, excerpt: excerpt(hit.reply.text)},
          provenance: {sourceFileId: file.id, sourceName: file.source.name, sourceSha256: checksum, ordinal: ordinal - 1, startByte: record.start, endByte: record.end, conversationSha256: sha(record.raw)},
        };
        const prev = bestByConversation.get(id);
        if (!prev || entry.score > prev.score) bestByConversation.set(id, {...entry, alsoIn: prev ? [...(prev.alsoIn || []), prev.provenance.sourceName] : []});
        else prev.alsoIn = [...(prev.alsoIn || []), file.source.name];
      }
    } catch { parseErrors++; } finally { await handle.close(); await rm(path); }
    occurrences += ordinal;
  }
  const candidates = [...bestByConversation.values()].sort((a, b) => b.score - a.score).slice(0, 40);
  const summary = {sourceFilesListed: sources.length, sourceFilesRead: read, exactDuplicateFilesSkipped: duplicates, pendingFilesExcluded: pending.length, sourceParseErrors: parseErrors, conversationOccurrences: occurrences, scoredOccurrences: scored, distinctScoredConversations: bestByConversation.size, candidatesReported: candidates.length, combinedUsageAndProfile: candidates.filter(c => c.usageHits && c.profileHits).length, writesAttempted: 0, shape};
  await mkdir('profile-result', {recursive: true});
  await writeFile('profile-result/summary.json', JSON.stringify(summary, null, 2));
  await writeFile(directory + '/report.json.gz', gzipSync(JSON.stringify({summary, candidates}, null, 1)), {mode: 0o600});
  execFileSync('openssl', ['cms', '-encrypt', '-binary', '-aes-256-cbc', '-in', directory + '/report.json.gz', '-out', 'profile-result/private-report.cms', '-outform', 'DER', 'tools/profile-recovery/recipient.pem'], {stdio: 'ignore'});
  console.log('Profile recovery finished: ' + JSON.stringify(summary));
} catch (e) {
  console.log('Profile recovery stopped: ' + (/^(Private|Source|Inventory|Read-only|Existing)/.test(e.message) ? e.message : 'bounded scan failed'));
  process.exitCode = 1;
} finally { await rm(directory, {recursive: true, force: true}); }
