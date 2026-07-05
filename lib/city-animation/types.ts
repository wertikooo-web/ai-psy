export type CityIntensity      = "quiet" | "normal" | "lively";
export type CharacterFrequency = "off" | "rare" | "normal" | "frequent";
export type EasterEggFrequency = "very_rare" | "rare" | "sometimes";

export interface CityAnimationSettings {
  animationEnabled:               boolean;
  intensity:                      CityIntensity;
  interactiveEasterEggsEnabled:   boolean;
  rareSurprisesEnabled:           boolean;
  interactionSoundsEnabled:       boolean;
  reduceMotionDuringConsultation: boolean;
  catsFrequency:                  CharacterFrequency;
  dogsFrequency:                  CharacterFrequency;
  birdsFrequency:                 CharacterFrequency;
  peopleFrequency:                CharacterFrequency;
  carsFrequency:                  CharacterFrequency;
  cyclistsFrequency:              CharacterFrequency;
  busesFrequency:                 CharacterFrequency;
  easterEggFrequency:             EasterEggFrequency;
  loveRunnerFrequency:            CharacterFrequency;
}

export const DEFAULT_CITY_ANIMATION_SETTINGS: CityAnimationSettings = {
  animationEnabled:               true,
  intensity:                      "normal",
  interactiveEasterEggsEnabled:   true,
  rareSurprisesEnabled:           true,
  interactionSoundsEnabled:       false,
  reduceMotionDuringConsultation: true,
  catsFrequency:                  "normal",
  dogsFrequency:                  "normal",
  birdsFrequency:                 "rare",
  peopleFrequency:                "normal",
  carsFrequency:                  "rare",
  cyclistsFrequency:              "rare",
  busesFrequency:                 "rare",
  easterEggFrequency:             "rare",
  loveRunnerFrequency:            "rare",
};

export const CITY_ANIM_STORAGE_KEY = "cityAnimSettings";

export const FREQUENCY_MULTIPLIERS: Record<CharacterFrequency, number> = {
  off:      0,
  rare:     0.4,
  normal:   1,
  frequent: 2.2,
};

export const INTENSITY_GROUND_INTERVAL: Record<CityIntensity, [number, number]> = {
  quiet:  [30_000, 70_000],
  normal: [5_000,  12_000],
  lively: [2_000,  5_000],
};

export const EASTER_EGG_INTERVAL: Record<EasterEggFrequency, [number, number]> = {
  very_rare: [480_000, 900_000],
  rare:      [180_000, 420_000],
  sometimes: [90_000,  240_000],
};
