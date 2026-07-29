/**
 * Physical dimensions of the substation node, in metres.
 *
 * These are the *geometry* counterpart to the physics constants in
 * `backend/sim/transformer.py`: every value cites the standard or reference it
 * comes from, for the same reason every telemetry number does
 * (docs/credibility-checklist.md -- "no number anywhere without a named model
 * or standard behind it").
 *
 * This matters more than mesh detail. A photoreal transformer at invented scale
 * is the "visual realism is NOT fidelity" failure the research flagged; a plain
 * one at correct scale survives an engineer's eye.
 *
 * SOURCES
 * - IEEE Std 1427-2020, Recommended Electrical Clearances and Insulation Levels
 *   in Air Insulated Electrical Power Substations. At 230 kV / 900 kV BIL the
 *   minimum clearances are 1.71 m phase-to-ground and 1.97 m phase-to-phase.
 * - NESC (IEEE C2), Part 1 -- substation fence height and clearance to live parts.
 * - IEEE Std C57.12.10 -- dimensional/electrical requirements for liquid-immersed
 *   transformers 230 kV and below.
 * - Asset spec: docs/domain-transformer.md (150/200/250 MVA ONAN/ONAF/OFAF,
 *   230/34.5 kV step-down).
 */

/** Nameplate context, mirrored from docs/domain-transformer.md. */
export const RATING = {
  hvKv: 230,
  lvKv: 34.5,
  /** Basic Insulation Level for the 230 kV winding; sets every air clearance. */
  hvBilKv: 900,
  mvaOnan: 150,
  mvaOnaf: 200,
  mvaOfaf: 250,
  /** A unit of this rating is ~236 t -- worth stating, it drives the scale. */
  massTonnes: 236,
} as const;

/**
 * IEEE 1427 minimum air clearances at 230 kV / 900 kV BIL. These are *minima*;
 * utilities build with margin, so the layout below uses the practical spacings
 * and asserts them against these floors in `verifyClearances`.
 */
export const CLEARANCE = {
  phaseToGroundM: 1.71,
  phaseToPhaseM: 1.97,
  /** NESC minimum height of live parts above grade at this voltage class. */
  livePartsAboveGradeM: 4.57,
} as const;

/**
 * Main tank of the 150/200/250 MVA unit. A transformer of this rating is a
 * ~236 t object roughly the size of a small house -- an order of magnitude
 * larger than a distribution pad-mount, which is the usual scale mistake.
 */
export const TRANSFORMER = {
  tankLengthM: 9.0,
  tankWidthM: 4.0,
  tankHeightM: 5.0,
  plinthHeightM: 0.45,
  /** Radiator banks stand off each long face. */
  radiatorDepthM: 1.3,
  radiatorHeightM: 3.6,
  radiatorBanksPerSide: 4,
  /** Conservator (oil expansion drum) sits above the tank cover. */
  conservatorDiameterM: 1.6,
  conservatorLengthM: 5.5,
} as const;

/**
 * Bushings. Shed count and height differ sharply between the 230 kV and
 * 34.5 kV sides -- that contrast is the clearest visual signal that this is a
 * step-down unit, so it is dimensioned rather than eyeballed.
 */
export const BUSHING = {
  hv: {
    heightM: 3.4,
    radiusM: 0.24,
    sheds: 18,
    /** Practical utility spacing, comfortably above the 1.97 m IEEE 1427 floor. */
    phaseSpacingM: 3.2,
  },
  lv: {
    heightM: 1.3,
    radiusM: 0.17,
    sheds: 8,
    phaseSpacingM: 1.4,
  },
} as const;

/** Yard equipment on the 230 kV side. */
export const YARD = {
  /** Rigid tubular aluminium main bus, on post insulators. */
  busHeightM: 7.9,
  busDiameterM: 0.15,
  /** SF6 dead-tank circuit breaker. */
  breaker: { lengthM: 5.0, widthM: 2.2, tankHeightM: 2.4, bushingHeightM: 3.0 },
  /** Station-class surge arrester. */
  arresterHeightM: 2.6,
  /** Capacitive voltage transformer. */
  cvtHeightM: 3.2,
  /** Lattice dead-end / take-off structure. */
  deadEndHeightM: 12.0,
  controlHouse: { lengthM: 12.0, widthM: 6.0, heightM: 4.0 },
  /** NESC: 2.13 m fabric + 0.30 m barbed outrigger. */
  fenceHeightM: 2.13,
  fenceBarbedM: 0.3,
  yardLengthM: 62.0,
  yardWidthM: 44.0,
} as const;

export interface ClearanceCheck {
  label: string;
  actualM: number;
  minimumM: number;
  passes: boolean;
}

/**
 * Assert the laid-out geometry against the IEEE 1427 minima.
 *
 * Rendered in the console so the clearances are claimed *and shown*, the same
 * way the thermal model is shown against its reference rather than asserted.
 */
export function verifyClearances(): ClearanceCheck[] {
  const checks: ClearanceCheck[] = [
    {
      label: "230 kV bushing phase-to-phase",
      actualM: BUSHING.hv.phaseSpacingM,
      minimumM: CLEARANCE.phaseToPhaseM,
      passes: false,
    },
    {
      label: "230 kV bus height above grade",
      actualM: YARD.busHeightM,
      minimumM: CLEARANCE.livePartsAboveGradeM,
      passes: false,
    },
    {
      label: "HV bushing top above grade",
      actualM: TRANSFORMER.plinthHeightM + TRANSFORMER.tankHeightM + BUSHING.hv.heightM,
      minimumM: CLEARANCE.livePartsAboveGradeM,
      passes: false,
    },
  ];
  return checks.map((c) => ({ ...c, passes: c.actualM >= c.minimumM }));
}
