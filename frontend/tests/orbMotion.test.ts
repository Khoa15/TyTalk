import { springStep, targetPose } from '../src/components/orb/TyTalkOrb';

const zeroPose = () => ({ sc: 0, x: 0, y: 0, tilt: 0, glow: 0, eyeY: 0, look: 0, fx: 0, fy: 0 });

describe('Orb motion graph', () => {
  it('an underdamped spring overshoots its target and then settles', () => {
    const pos = { ...zeroPose(), y: 10 }; // kicked 10px away from rest
    const vel = zeroPose();
    const target = zeroPose();
    let minY = Infinity;
    for (let i = 0; i < 300; i++) {
      springStep(pos, vel, target, 1 / 60, 14, 0.5);
      minY = Math.min(minY, pos.y);
    }
    expect(minY).toBeLessThan(-0.5);          // crossed the target (overshoot)
    expect(Math.abs(pos.y)).toBeLessThan(0.05); // settled
  });

  it('a critically damped spring does not overshoot', () => {
    const pos = { ...zeroPose(), y: 10 };
    const vel = zeroPose();
    let minY = Infinity;
    for (let i = 0; i < 300; i++) {
      springStep(pos, vel, zeroPose(), 1 / 60, 14, 1);
      minY = Math.min(minY, pos.y);
    }
    expect(minY).toBeGreaterThan(-0.05);
  });

  it('idle expresses more with higher expressiveness', () => {
    const calm = targetPose('idle', 1.3, 0, 0, 1, 0.1);
    const lively = targetPose('idle', 1.3, 0, 0, 1, 0.9);
    expect(Math.abs(lively.look)).toBeGreaterThan(Math.abs(calm.look));
    expect(Math.abs(lively.tilt)).toBeGreaterThan(Math.abs(calm.tilt));
  });

  it('reduced motion scales amplitudes down', () => {
    const full = targetPose('dizzy', 1, 0, 0, 1);
    const reduced = targetPose('dizzy', 1, 0, 0, 0.3);
    expect(Math.abs(reduced.tilt)).toBeLessThan(Math.abs(full.tilt));
  });
});
