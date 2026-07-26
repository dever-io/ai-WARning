/** Wire types shared by the server and the web client. */

export type MeterKey = 'ctl' | 'pwr' | 'eco' | 'trs' | 'pln';
export type FactionStatKey = 'coh' | 'inf' | 'doc';
export type Dir = 'yes' | 'no';
export type Scope = 'world' | 'faction';
export type Creed = 'guardian' | 'pragmatist' | 'accelerationist';

export const DAYS = 3;
export const CHOICES_PER_DAY = 3;
export const ROUNDS_TOTAL = DAYS * CHOICES_PER_DAY;

export interface MeterView {
  key: MeterKey;
  label: string;
  value: number;
  danger: boolean;
}

export interface StatView {
  key: FactionStatKey;
  label: string;
  value: number;
  /** Doctrine has no "good" direction — it is a position, not a score. */
  neutral: boolean;
}

export interface ChoiceView {
  label: string;
  note: string;
  fx: Record<string, number>;
}

export interface CardView {
  id: string;
  scope: Scope;
  src: string;
  title: string;
  ctx: string;
  chipLabel: string;
  chipColor: string;
  yes: ChoiceView;
  no: ChoiceView;
}

export interface TallyView {
  yes: number;
  no: number;
  /** Extra bloc weight already folded into yes/no, per faction. */
  blocs: Array<{ name: string; stance: Dir; weight: number }>;
  /** Total ballots visible so far (bots stream in across the round). */
  counted: number;
  /** Ballots still outstanding. */
  pending: number;
}

export interface UserView {
  id: number;
  handle: string;
  factionId: number | null;
}

export interface FactionSummary {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  creed: Creed;
  members: number;
  cohesion: number;
  influence: number;
  doctrine: number;
  /** Bloc weight this faction adds to a world vote at current strength. */
  clout: number;
  isMine: boolean;
}

export interface FactionMember {
  handle: string;
  isBot: boolean;
  isFounder: boolean;
  vote: Dir | null;
}

export interface MyFactionView extends FactionSummary {
  joinCode: string;
  isFounder: boolean;
  roster: FactionMember[];
  stats: StatView[];
  card: CardView | null;
  myVote: Dir | null;
  tally: TallyView | null;
  lastResult: {
    round: number;
    result: Dir;
    note: string;
    yes: number;
    no: number;
    fx: Record<string, number>;
  } | null;
}

export interface RoundRecord {
  round: number;
  day: number;
  slot: number;
  title: string;
  src: string;
  chipLabel: string;
  chipColor: string;
  result: Dir;
  resultLabel: string;
  note: string;
  yes: number;
  no: number;
  mandate: number;
  fx: Record<string, number>;
  meters: Record<MeterKey, number>;
  myVote: Dir | null;
}

export interface EndingView {
  key: string;
  title: string;
  verdict: string;
  tone: 'good' | 'mixed' | 'bad';
  meters: MeterView[];
  personal: { title: string; line: string; withMajority: number; against: number; abstained: number };
  faction: { name: string; title: string; line: string } | null;
  leaderboard: Array<{ name: string; influence: number; cohesion: number; members: number }>;
}

export interface GameState {
  now: number;
  user: UserView;
  epoch: {
    id: number;
    day: number;
    slot: number;
    round: number;
    roundsTotal: number;
    daysTotal: number;
    status: 'running' | 'ended';
    roundEndsAt: number;
    roundStartedAt: number;
    roundMs: number;
    population: number;
  };
  meters: MeterView[];
  world: {
    card: CardView | null;
    myVote: Dir | null;
    tally: TallyView;
  };
  faction: MyFactionView | null;
  /** Set once every open decision for this round has been filed. */
  standby: boolean;
  history: RoundRecord[];
  ending: EndingView | null;
  devTools: boolean;
}

export interface ApiError {
  error: string;
}
