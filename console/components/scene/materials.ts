/**
 * Scene palette. Stylized industrial and matte -- high roughness, low
 * metalness, no chrome (docs/brand.md). A healthy node is monochrome; Forge Red
 * appears only as a genuine alert state driven by twin state.
 */

/**
 * Values are lifted well clear of Void Black: the base is the *scene backdrop*,
 * not the asset. A transformer painted at background luminance reads as a black
 * blob and defeats the point of rendering it, so the steel sits mid-grey and the
 * silhouette carries the form.
 */
export const SCENE = {
  /** Void Black, the scene base. */
  background: "#0b0c0f",
  pad: "#232630",
  tank: "#6f7683",
  tankDark: "#525966",
  radiator: "#5e6573",
  fan: "#3a3f4a",
  insulator: "#c3c7cf",
  conductor: "#8a909c",
  forgeRed: "#ff3b00",
} as const;

/** Matte industrial surface defaults, applied to every painted steel part. */
export const MATTE = { roughness: 0.85, metalness: 0.1 } as const;

/** Porcelain bushings read slightly smoother than painted steel. */
export const PORCELAIN = { roughness: 0.45, metalness: 0.05 } as const;
