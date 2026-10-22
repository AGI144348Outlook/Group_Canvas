"""Bounded symbolic adaptation bridge. No word->role answer rules in this module.

Structural priors: four supplied role/position selectors. This learns label-to-selector
associations, not English grammar, visual perception, or arbitrary new predicates.
"""
from copy import deepcopy

ARMS = ['first', 'last', 'speaker', 'addressee']

def checked_scene(scene):
    if not isinstance(scene, dict) or set(scene) != {'entities', 'speaker', 'addressee'}:
        raise ValueError('Only participant context is allowed; no answer fields')
    ids = scene['entities']
    if not isinstance(ids, list) or not 1 <= len(ids) <= 12 or len(set(ids)) != len(ids):
        raise ValueError('Invalid participant identities')
    if any(not isinstance(x, str) or not x or len(x) > 80 for x in ids):
        raise ValueError('Invalid entity')
    for key in ['speaker', 'addressee']:
        if scene[key] is not None and scene[key] not in ids:
            raise ValueError('Role refers to absent entity')
    return scene

def resolve(arm, scene):
    checked_scene(scene)
    return scene['entities'][0] if arm == 'first' else scene['entities'][-1] if arm == 'last' else scene[arm]

class Learner:
    def __init__(self, core, mode='counter', state=None):
        if mode not in ('counter', 'echo-ucb'):
            raise ValueError('Unknown policy')
        self.core, self.mode = core, mode
        self.matrix = core.AlgorithmMatrix()
        self.identity = core.ReshIdentity(self.matrix)
        self.identity.anchor()
        self.links, self.pending, self.events, self.completed = {}, None, [], 0
        if state is not None:
            self.restore(state)

    def expose(self, word):
        if not isinstance(word, str) or not word.strip() or len(word) > 80:
            raise ValueError('Invalid label')
        if word not in self.links:
            self.links[word] = {a: {'counter': 1, 'wins': 0, 'losses': 0} for a in ARMS}

    def predict(self, word, scene):
        checked_scene(scene)
        # Read-only prediction: no answer key, teacher card or mutation here.
        if word not in self.links:
            return {'arm': None, 'entity': None, 'basis': 'unexposed'}
        if self.mode == 'echo-ucb':
            arm = self.matrix.bandit_select(word, ARMS)
        else:
            arm = max(ARMS, key=lambda a: self.links[word][a]['counter'])
        return {'arm': arm, 'entity': resolve(arm, scene),
                'basis': 'A-101' if self.mode == 'echo-ucb' else 'new B1-c candidate bridge'}

    def attempt(self, word, scene):
        if self.pending is not None:
            raise ValueError('Teacher feedback is pending')
        self.expose(word)
        result = self.predict(word, scene)
        self.pending = {'id': self.completed + 1, 'word': word,
                        'scene': deepcopy(scene), 'prediction': result}
        self.events.append({'kind': 'attempt', **deepcopy(self.pending)})
        return deepcopy(self.pending)

    def grade(self, turn, correct_entity, actor='teacher'):
        if actor != 'teacher':
            raise PermissionError('This local teaching API requires teacher feedback')
        if self.pending is None or turn != self.pending['id']:
            raise ValueError('No matching pending turn')
        p = self.pending
        if correct_entity not in p['scene']['entities']:
            raise ValueError('Teacher must identify a present participant')
        success = p['prediction']['entity'] == correct_entity
        checkpoint = None
        if self.mode == 'counter':
            # Labelled teacher correction tests all supplied hypotheses.
            # This is additional supervised evidence, not identical feedback to UCB.
            for arm in ARMS:
                link = self.links[p['word']][arm]
                good = resolve(arm, p['scene']) == correct_entity
                link['counter'] = min(3, max(0, link['counter'] + (1 if good else -1)))
                link['wins' if good else 'losses'] += 1
        self.matrix.record_outcome(p['prediction']['arm'], p['word'], success)
        self.completed += 1
        if self.completed % 4 == 0:
            checkpoint = self.matrix.checkpoint_generation()
        event = {'kind': 'feedback', 'turn': turn, 'word': p['word'], 'correct': success,
                 'teacher_entity': correct_entity, 'scale': '=' if success else '<',
                 'checkpoint': checkpoint, 'links': deepcopy(self.links[p['word']])}
        self.events.append(event)
        self.pending = None
        return deepcopy(event)

    def state(self):
        table = lambda t: [[a, w, s, n] for (a, w), (s, n) in sorted(t.items())]
        return {'format': 'echo-classroom-state/1', 'mode': self.mode,
                'links': deepcopy(self.links), 'completed': self.completed,
                'history': table(self.matrix.history), 'generation': table(self.matrix.current_generation),
                'pending': deepcopy(self.pending), 'events': deepcopy(self.events)}

    def restore(self, state):
        if state.get('format') != 'echo-classroom-state/1' or state.get('mode') != self.mode:
            raise ValueError('Wrong state format')
        if type(state.get('completed')) is not int or state['completed'] < 0:
            raise ValueError('Invalid turn count')
        for word, links in state['links'].items():
            if not isinstance(word, str) or set(links) != set(ARMS):
                raise ValueError('Invalid hypothesis set')
            for item in links.values():
                if set(item) != {'counter', 'wins', 'losses'} or any(type(x) is not int or x < 0 for x in item.values()) or item['counter'] > 3:
                    raise ValueError('Invalid candidate evidence')
        def table(rows):
            result = {}
            for arm, word, success, attempts in rows:
                if arm not in ARMS or word not in state['links'] or any(type(v) is not int or v < 0 for v in [success, attempts]) or success > attempts or (arm,word) in result:
                    raise ValueError('Invalid outcome table')
                result[(arm, word)] = (success, attempts)
            return result
        history, generation = table(state['history']), table(state['generation'])
        pending = state.get('pending')
        if pending is not None:
            checked_scene(pending['scene'])
            if pending['id'] != state['completed'] + 1 or pending['word'] not in state['links']:
                raise ValueError('Invalid pending turn')
        self.links, self.pending, self.events, self.completed = deepcopy(state['links']), deepcopy(pending), deepcopy(state['events']), state['completed']
        self.matrix.history, self.matrix.current_generation = history, generation
