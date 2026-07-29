/**
 * CC-BY attribution for the hero mesh.
 *
 * **Not optional.** The model ships under CC-BY-4.0, whose sole requirement is
 * that the author is credited; shipping it without this breaches the licence,
 * and this is a commercial client demo. Rendered whenever the hero mesh is in
 * use, and removed only if the mesh is.
 *
 * Credit text is the string supplied in the model's own `license.txt`.
 */

export interface ModelAttributionProps {
  visible: boolean;
}

const MODEL_TITLE = "high_voltage_power_transformer (1)";
const MODEL_URL =
  "https://sketchfab.com/3d-models/high-voltage-power-transformer-1-43277271f7aa4d538259a029e8337bea";
const AUTHOR = "b4_cobra";
const AUTHOR_URL = "https://sketchfab.com/sultanbaddad3";
const LICENSE_URL = "http://creativecommons.org/licenses/by/4.0/";

export function ModelAttribution({ visible }: ModelAttributionProps) {
  if (!visible) return null;

  return (
    <p className="text-[11px] leading-snug text-text-tertiary">
      3D model{" "}
      <a
        href={MODEL_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-border underline-offset-2 hover:text-text-secondary"
      >
        {MODEL_TITLE}
      </a>{" "}
      by{" "}
      <a
        href={AUTHOR_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-border underline-offset-2 hover:text-text-secondary"
      >
        {AUTHOR}
      </a>
      , licensed{" "}
      <a
        href={LICENSE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-border underline-offset-2 hover:text-text-secondary"
      >
        CC BY 4.0
      </a>
      .
    </p>
  );
}
