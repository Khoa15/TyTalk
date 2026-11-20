import { FORMS } from '../../lib/space/designArt';
import { useClock } from '../../lib/space/clock';
import type { OrbForm } from '../../lib/space/types';

// The design art draws its own eyes. The orb draws the real face on top, so drop the art's copy.
const EYE_RE = /<rect x="(174|214)" y="182"[^>]*\/>/g;

/** Body art for a space form, from the design board. The orb's eyes are drawn above it. */
export function FormArt({ form }: { form: Exclude<OrbForm, 'orb'> }) {
  const t = useClock();
  const html = FORMS[form](t).replace(EYE_RE, '');
  return <g className={`tyorb-form tyorb-form-${form}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
