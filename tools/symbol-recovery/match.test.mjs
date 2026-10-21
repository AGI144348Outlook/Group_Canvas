import assert from 'node:assert/strict';import {match} from './match.mjs';
assert.equal(match('The price is 2+3 = 5.'),null);
assert.equal(match('π is useful in geometry.'),null);
assert.equal(match('☢ radiation warning'),null);
assert.equal(match('The 96-symbol substrate symbolic kernel').basis,'named-kernel');
assert(match('Echo uses ∫ memory and recursion').categories.includes('memory'));
assert.equal(match('Mashet uses α as a symbol').basis,'contextual-common-symbol');
assert.equal(match('Echo learns persistence'),null);
console.log('Seven synthetic matching assertions passed.');

const {gzipSync,gunzipSync}=await import('node:zlib');const fixture={mapping:{a:{message:{content:{parts:['Echo ∫ memory']}}}}};assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(gzipSync(Buffer.from(JSON.stringify(fixture))).toString('base64'),'base64')).toString()),fixture);console.log('Lossless conversation compression round-trip passed.');
