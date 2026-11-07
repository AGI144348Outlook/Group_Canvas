import assert from 'node:assert/strict';
import {openingPaths, scoreConversation} from './match.mjs';

const node = (id, parent, role, text, children = []) => ({id, parent, children, message: role ? {author: {role}, create_time: 1, content: {content_type: 'text', parts: [text]}} : null});
const convo = nodes => ({mapping: Object.fromEntries(nodes.map(n => [n.id, n]))});

// 1. Profile reply with usage statistics on an alternate branch is found.
const branched = convo([
  node('root', null, null, '', ['u1']),
  node('u1', 'root', 'user', 'Based on everything you know about me from our past conversations, write a psychological profile.', ['a1', 'a2']),
  node('a1', 'u1', 'assistant', 'Sure, here is a recipe for soup.'),
  node('a2', 'u1', 'assistant', 'Psychological profile: you tend to explore broadly. Your strengths include synthesis. You were active 24 of the last 30 days, about 3 hours per day.'),
]);
assert.equal(openingPaths(branched).length, 2, 'both branches walked');
const hit = scoreConversation(branched);
assert.ok(hit && hit.usageHits >= 1 && hit.profileHits >= 1, 'usage+profile branch retained');
assert.equal(hit.reply.id, 'a2', 'best branch chosen');

// 2. Ordinary usage numbers without a profile still score lower than the combined case.
const recipe = convo([
  node('u', null, 'user', 'How long should I knead dough?', ['a']),
  node('a', 'u', 'assistant', 'Knead it 10 minutes per day for a sourdough starter routine.'),
]);
const r = scoreConversation(recipe);
assert.ok(!r || r.score < hit.score, 'incidental usage phrase ranks below profile+usage');

// 3. Plain chat with neither signal is rejected.
const plain = convo([node('u', null, 'user', 'Hello', ['a']), node('a', 'u', 'assistant', 'Hi! How can I help?')]);
assert.equal(scoreConversation(plain), null, 'no-signal conversation rejected');

// 4. Nodes without `children` arrays are still walked through parent links.
const noKids = convo([
  {id: 'r', parent: null, message: null},
  {id: 'u', parent: 'r', message: {author: {role: 'user'}, content: {content_type: 'text', parts: ['Give me a psychological profile of me']}}},
  {id: 'a', parent: 'u', message: {author: {role: 'assistant'}, content: {content_type: 'text', parts: ['Your strengths: focus. You tend to dig deep. You use ChatGPT about 20 days per month.']}}},
]);
assert.equal(openingPaths(noKids).length, 1, 'parent-linked walk');
assert.ok(scoreConversation(noKids)?.usageHits >= 1, 'parent-linked usage hit');

console.log('profile-recovery match tests: 6 assertions passed');
