export type MeterKey = 'ctl' | 'pwr' | 'eco' | 'trs' | 'pln';
export type CategoryKey = 'city' | 'world' | 'company';
export type Dir = 'yes' | 'no';

export type Fx = Partial<Record<MeterKey, number>>;
export type Meters = Record<MeterKey, number>;

export interface MeterDef {
  key: MeterKey;
  label: string;
  start: number;
  danger: boolean;
  note: string;
}

export interface Choice {
  fx: Fx;
  note: string;
}

export interface Card {
  cat: CategoryKey;
  src: string;
  title: string;
  ctx: string;
  yes: Choice;
  no: Choice;
}

export interface Category {
  label: string;
  color: string;
}

export interface GameData {
  meters: MeterDef[];
  categories: Record<CategoryKey, Category>;
  rules: {
    choicesPerDay: number;
    swipeRight: Dir;
    swipeLeft: Dir;
    clamp: [number, number];
    loop: string;
    delta_sign_convention: string;
  };
  deck: Card[];
}

export interface LastChoice {
  dir: Dir;
  note: string;
}

export interface GameState {
  meters: Meters;
  idx: number;
  made: number;
  last: LastChoice | null;
  /** Fail-state description; non-null once the run is lost. */
  over: string | null;
}
