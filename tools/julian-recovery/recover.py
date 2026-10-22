"""Prepared, unexecuted Julian recovery core. Input: NDJSON conversation envelopes.

Retains complete matching conversations. Attribution is an explicitly marked
heuristic for review; platform roles and raw source messages are unchanged.
"""
import hashlib
import json
import re
import sys
import gzip
import zipfile
from pathlib import Path

NAME = re.compile(r'(?<!\w)Julian(?:\s+Thornfield)?(?!\w)', re.I)
ADDRESS = re.compile(
    r'^\s*(?:(?:hey|hi|hello|dear|okay|ok|thanks|thank you)[, !:.\-]+)?'
    r'Julian(?:\s+Thornfield)?(?=\s*[,!:?\-]|\s*$)', re.I)
SWITCH = re.compile(r'\b(?:stop (?:being|playing|roleplaying)|switch (?:to|back)|'
                    r'you are (?:now|no longer)|speak (?:to me )?as)\b', re.I)


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':')).encode()).hexdigest()


def strings(message):
    """Keep string parts whole; do not recursively search unrelated metadata."""
    content = message.get('content')
    if isinstance(content, dict):
        parts = [p for p in content.get('parts', []) if isinstance(p, str)]
        if not parts and isinstance(content.get('text'), str):
            parts = [content['text']]
        return parts
    if isinstance(content, list):
        parts = [p['text'] for p in content
                 if isinstance(p, dict) and isinstance(p.get('text'), str)]
        if parts:
            return parts
    return [message['text']] if isinstance(message.get('text'), str) else []


def role(message):
    author = message.get('author')
    result = author.get('role') if isinstance(author, dict) else None
    result = result or message.get('sender') or message.get('role') or 'unknown'
    return 'user' if result == 'human' else result


def recover(provider, conversation, source):
    rows = {}
    warnings = []
    if provider == 'openai':
        mapping = conversation.get('mapping')
        if not isinstance(mapping, dict):
            raise ValueError('Unsupported OpenAI mapping')
        for key, node in mapping.items():
            if not isinstance(node, dict):
                raise ValueError('Invalid mapping node')
            message = node.get('message')
            rows[key] = {'id': key, 'parent': node.get('parent'),
                         'message': message if isinstance(message, dict) else {},
                         'recorded_children': node.get('children', [])}
    elif provider == 'claude':
        messages = conversation.get('chat_messages', conversation.get('messages'))
        if not isinstance(messages, list):
            raise ValueError('Unsupported Claude message list')
        has_parents = any(isinstance(m, dict) and
                          'parent_message_uuid' in m for m in messages)
        previous = None
        for ordinal, message in enumerate(messages):
            if not isinstance(message, dict):
                raise ValueError('Invalid Claude message')
            key = str(message.get('uuid') or message.get('id') or ordinal)
            if key in rows:
                raise ValueError('Duplicate Claude message identity')
            rows[key] = {'id': key, 'parent': message.get('parent_message_uuid')
                         if has_parents else previous, 'message': message,
                         'export_ordinal': ordinal}
            previous = key
        if not has_parents:
            warnings.append('Claude export order used; branch structure unproven')
    else:
        raise ValueError('Unsupported provider')

    hits = []
    for row in rows.values():
        parts = strings(row['message'])
        row['text_parts'] = parts
        row['recorded_role'] = role(row['message'])
        row['message_sha256'] = digest(row['message'])
        row['name_matches'] = [{'part': i, 'start': match.start(),
                                'end': match.end(), 'matched': match.group()}
                               for i, part in enumerate(parts)
                               for match in NAME.finditer(part)]
        text = '\n'.join(parts)
        row['direct_address_candidate'] = bool(
            row['recorded_role'] == 'user' and ADDRESS.search(text))
        row['possible_persona_change'] = bool(
            row['recorded_role'] == 'user' and SWITCH.search(text))
        if row['name_matches']:
            hits.append(row['id'])

    title = conversation.get('title') or conversation.get('name') or ''
    title_match = bool(NAME.search(title)) if isinstance(title, str) else False
    if not hits and not title_match:
        return None

    # Walk each node's ancestors independently. Mapping insertion order cannot
    # leak a Julian attribution into an unrelated sibling branch.
    for row in rows.values():
        current = row['id']
        seen = set()
        anchor = None
        reason = 'no-direct-address-anchor'
        while current is not None:
            if current in seen or current not in rows:
                reason = 'unresolved-parent-or-cycle'
                warnings.append(reason)
                break
            seen.add(current)
            ancestor = rows[current]
            if ancestor['possible_persona_change']:
                reason = 'possible-persona-change-needs-review'
                break
            if ancestor['direct_address_candidate']:
                anchor = current
                reason = 'Julian-context-by-user-convention-needs-review'
                break
            current = ancestor['parent']
        row['julian_anchor_id'] = anchor
        row['attribution_status'] = reason
        row['display_speaker_candidate'] = (
            'Julian' if anchor is not None and row['recorded_role'] == 'assistant'
            else row['recorded_role'])

    return {'format': 'project-julian/1', 'provider': provider, 'source': source,
            'conversation_sha256': digest(conversation),
            'conversation_id': conversation.get('uuid') or conversation.get('id')
                               or conversation.get('conversation_id'),
            'title': title, 'matching_message_ids': hits,
            'title_match': title_match, 'warnings': sorted(set(warnings)),
            'messages': list(rows.values()), 'original_conversation': conversation,
            'review_status': 'unreviewed; direct-address detection is heuristic',
            'text_truncated': False}


def main():
    target = Path(sys.argv[1])
    summary = {'conversations_scanned': 0, 'messages_scanned': 0,
               'matching_conversations': 0, 'matching_messages': 0,
               'retained_messages': 0, 'direct_address_candidates': 0,
               'assistant_replies_in_julian_context': 0,
               'conversations_with_warnings': 0, 'providers': {},
               'text_truncated': False, 'review_status': 'unreviewed'}
    with target.open('w', encoding='utf-8') as output:
        def add(provider, conversation, source):
            result = recover(provider, conversation, source)
            summary['conversations_scanned'] += 1
            p = summary['providers'].setdefault(provider, {'scanned': 0, 'matched': 0})
            p['scanned'] += 1
            if provider == 'openai':
                summary['messages_scanned'] += sum(isinstance(n, dict) and
                    isinstance(n.get('message'), dict) for n in conversation['mapping'].values())
            else:
                summary['messages_scanned'] += len(conversation.get('chat_messages', conversation.get('messages', [])))
            if result is None:
                return
            p['matched'] += 1
            summary['matching_conversations'] += 1
            summary['matching_messages'] += len(result['matching_message_ids'])
            summary['retained_messages'] += len(result['messages'])
            summary['direct_address_candidates'] += sum(r['direct_address_candidate'] for r in result['messages'])
            summary['assistant_replies_in_julian_context'] += sum(
                r['display_speaker_candidate'] == 'Julian' for r in result['messages'])
            summary['conversations_with_warnings'] += bool(result['warnings'])
            output.write(json.dumps(result, ensure_ascii=False) + '\n')
            if output.tell() > 512 * 1024**2:
                raise ValueError('Private output exceeds 512 MiB budget')
        for line in sys.stdin:
            item = json.loads(line)
            if 'archive_path' not in item:
                add(item['provider'], item['conversation'], item['source'])
                continue
            with zipfile.ZipFile(item['archive_path']) as archive:
                if sum(i.file_size for i in archive.infolist()) > 512 * 1024**2:
                    raise ValueError('Claude expansion bound')
                if archive.testzip() is not None:
                    raise ValueError('Claude ZIP CRC mismatch')
                found = False
                for name in archive.namelist():
                    if not name.endswith('conversations.json'):
                        continue
                    found = True
                    data = json.loads(archive.read(name))
                    if isinstance(data, dict):
                        data = data.get('conversations')
                    if not isinstance(data, list):
                        raise ValueError('Claude conversations schema')
                    for ordinal, conversation in enumerate(data):
                        add('claude', conversation, {**item['source'],
                            'ordinal': ordinal, 'archive_member': name})
                if not found:
                    raise ValueError('Claude conversations member missing')
    target.with_suffix('.summary.json').write_text(json.dumps(summary, indent=2))
    with target.open('rb') as source, gzip.GzipFile(str(target) + '.gz', 'wb', mtime=0) as packed:
        while chunk := source.read(1024 * 1024):
            packed.write(chunk)


if __name__ == '__main__':
    main()
