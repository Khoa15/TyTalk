import { TransitionController, edgeFor, normalizeRoute, type Route } from '../src/lib/transitionGraph';

function run(ctrl: TransitionController, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) ctrl.tick(1 / 60);
}

describe('transition graph', () => {
  it('uses the edge-specific motion and orb state, falling back to the default edge', () => {
    expect(edgeFor('/signin', '/signup').orb).toBe('talking');
    expect(edgeFor('/', '/talk').orb).toBe('idle'); // no explicit edge: default motion
  });

  it('normalises unknown paths to the landing route', () => {
    expect(normalizeRoute('/nope')).toBe('/');
    expect(normalizeRoute('/talk')).toBe('/talk');
  });

  it('swaps the route exactly once while the old page is out, then settles to idle', () => {
    const swaps: Route[] = [];
    const ctrl = new TransitionController((to) => swaps.push(to));
    ctrl.request('/', '/signin');
    expect(ctrl.currentPhase).toBe('leaving');
    expect(ctrl.orb).toBe('cute');
    run(ctrl, 2);
    expect(swaps).toEqual(['/signin']);
    expect(ctrl.currentPhase).toBe('idle');
    expect(ctrl.orb).toBeNull();
  });

  it('retargets a transition requested mid-flight to the newest destination', () => {
    const swaps: Route[] = [];
    const ctrl = new TransitionController((to) => swaps.push(to));
    ctrl.request('/', '/signin');
    run(ctrl, 0.05);
    ctrl.request('/', '/signup');
    run(ctrl, 2);
    expect(swaps).toEqual(['/signup']);
  });

  it('form edges fade out downwards and fade in from above, with no horizontal slide', () => {
    const ctrl = new TransitionController(() => {});
    ctrl.request('/signin', '/signup');
    run(ctrl, 0.1);
    expect(ctrl.transform.x).toBe(0);
    expect(ctrl.transform.y).toBeGreaterThan(0); // leaving: moving down
    expect(ctrl.transform.o).toBeLessThan(1);    // and fading out
  });
});
