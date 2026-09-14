import { describe, expect, it } from 'vitest';
import { dropOffersNode, panelTarget } from '../Canvas';

/**
 * What a gesture on the canvas means (USER_FLOWS §1.2).
 *
 * Dragging a node and choosing one are different gestures, and React Flow reports the first as the
 * second: pressing on a card selects it, so every drag used to light the card up as chosen. A drag
 * says nothing about what was chosen; only a click does.
 */
describe('the node a gesture chooses', () => {
  it('is the node that was clicked', () => {
    expect(panelTarget({ dragged: false, nodeId: 'writer' })).toBe('writer');
  });

  it('is nothing when the empty canvas was clicked', () => {
    expect(panelTarget({ dragged: false, nodeId: null })).toBe(null);
  });

  it('is left alone by a drag, whichever node was under the pointer', () => {
    expect(panelTarget({ dragged: true, nodeId: 'writer' })).toBeUndefined();
    expect(panelTarget({ dragged: true, nodeId: null })).toBeUndefined();
  });
});

/**
 * What a wire let go of means. Pulling a wire off a port runs through the same gesture as drawing a
 * new one, so letting go over empty canvas used to ask what node should go there — when what the
 * person did was take a wire away.
 */
describe('a wire dropped on bare canvas', () => {
  const drop = { isValid: false, onNode: false, fromNode: true, fromHandle: true, reconnecting: false };
  it('asks what node should go there', () => {
    expect(dropOffersNode(drop)).toBe(true);
  });

  it('asks nothing when the wire was being pulled off one that was already there', () => {
    expect(dropOffersNode({ ...drop, reconnecting: true })).toBe(false);
  });

  it('asks nothing when it landed on a node, or connected, or came from nowhere', () => {
    expect(dropOffersNode({ ...drop, onNode: true })).toBe(false);
    expect(dropOffersNode({ ...drop, isValid: true })).toBe(false);
    expect(dropOffersNode({ ...drop, fromNode: false })).toBe(false);
    expect(dropOffersNode({ ...drop, fromHandle: false })).toBe(false);
  });
});
