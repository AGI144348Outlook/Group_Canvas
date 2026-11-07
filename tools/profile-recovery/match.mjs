// Scores the opening of each conversation branch for a "profile assessment" reply
// that also states how often the user uses ChatGPT. Pure functions; no I/O.
import {contentText} from '../../public/tower/archive-parser.js';

const NUM = '(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a few|several|multiple)';
const USAGE = [
  new RegExp(`${NUM}\\s*(?:-|to)?\\s*${NUM}?\\s*(?:hours?|hrs?|days?|times|sessions?|conversations?|chats?)\\s*(?:a|per|each|every|/|out of the last|of the last|in the last|in the past)\\s*(?:\\d+\\s*)?(?:day|week|month|days)`, 'i'),
  /\bactive\s+(?:on\s+)?(?:about\s+)?\d+\s+(?:of|out of|days)/i,
  /\b(?:last|past)\s+(?:30|thirty)\s+days\b/i,
  /\b(?:days?|hours?)\s+(?:per|a|each)\s+month\b/i,
  /\b(?:usage|activity)\s+(?:pattern|frequency|statistics|stats|data|metrics)\b/i,
  /\bhow\s+(?:often|frequently|much)\s+you\s+(?:use|log|come|chat|engage)/i,
];
const PROFILE_REPLY = [
  /\b(?:psychological|personality|cognitive|behaviou?ral|user)\s+(?:profile|assessment|analysis|portrait|traits?)\b/i,
  /\bprofile\s+(?:of|on)\s+you\b/i,
  /\b(?:strengths|blind\s*spots|weaknesses|tendencies|core\s+drives?|motivations?)\b/i,
  /\bbased\s+on\s+(?:our|your|everything|what|all)\b[^.]{0,60}\b(?:conversations?|interactions?|chats?|history|usage|know)/i,
  /\byou\s+(?:tend|seem|appear)\s+to\b/i,
];
const PROFILE_PROMPT = [
  /\b(?:profile|assess(?:ment)?|psycholog|personality|analy[sz]e\s+me|evaluate\s+me|diagnos)/i,
  /\b(?:everything|what)\s+you\s+know\s+about\s+me\b/i,
  /\b(?:tell|describe)\s+me\s+(?:about\s+)?(?:myself|who\s+i\s+am)\b/i,
  /\b(?:based\s+on|from)\s+(?:our|my|all)\s+(?:past\s+)?(?:conversations?|chats?|interactions?|history)\b/i,
  /\b(?:act|pretend)\s+as\b|\byou\s+are\s+(?:an?|my)\s+\w+/i,
];

const count = (patterns, text) => patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
const roleOf = n => n?.message?.author?.role;
const textOf = n => contentText(n?.message).text || '';

// Returns visible messages along every root-to-node path up to `depth` turns.
export function openingPaths(conversation, depth = 8) {
  const mapping = conversation?.mapping || {};
  const roots = Object.values(mapping).filter(n => !n.parent || !mapping[n.parent]);
  const paths = [];
  const walk = (node, path) => {
    const role = roleOf(node), text = textOf(node).trim();
    const next = (role === 'user' || role === 'assistant') && text ? [...path, {id: node.id, role, text, time: node.message?.create_time ?? null, parent: node.parent ?? null}] : path;
    const kids = (node.children || []).map(c => mapping[c]).filter(Boolean);
    if (next.length >= depth || !kids.length) { if (next.length) paths.push(next); return; }
    for (const k of kids) walk(k, next);
  };
  for (const r of roots) walk(r, []);
  return paths;
}

export function scorePath(path) {
  const firstUser = path.find(m => m.role === 'user');
  if (!firstUser) return null;
  let best = null;
  for (const m of path) {
    if (m.role !== 'assistant') continue;
    const usage = count(USAGE, m.text), profile = count(PROFILE_REPLY, m.text);
    if (!usage && profile < 2) continue;
    const score = usage * 3 + profile + (usage && profile ? 4 : 0);
    if (!best || score > best.score) best = {message: m, usage, profile, score};
  }
  if (!best) return null;
  const prompt = count(PROFILE_PROMPT, firstUser.text);
  const long = firstUser.text.length > 400 ? 1 : 0; // pasted engineered prompts tend to be long
  return {score: best.score + prompt * 2 + long, usageHits: best.usage, profileHits: best.profile, promptHits: prompt, firstUser, reply: best.message};
}

export function excerpt(text, max = 700) {
  const i = USAGE.map(p => text.search(p)).filter(x => x >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, i - Math.floor(max / 3));
  return (start ? '…' : '') + text.slice(start, start + max) + (start + max < text.length ? '…' : '');
}

export function scoreConversation(conversation) {
  let best = null, branches = 0;
  for (const path of openingPaths(conversation)) {
    branches++;
    const s = scorePath(path);
    if (s && (!best || s.score > best.score)) best = s;
  }
  return best ? {...best, branches} : null;
}
