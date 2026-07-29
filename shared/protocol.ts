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
  /** Outcome text — omitted for world cards until the round has resolved. */
  note?: string;
  /**
   * Omitted for world cards: the impact of a world decision stays sealed until
   * the next morning's report, so it is never sent to the client in advance.
   */
  fx?: Record<string, number>;
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
  /** True once the morning report for this round's day has landed. */
  reported: boolean;
  /** Empty while the round is still sealed. */
  fx: Record<string, number>;
  myVote: Dir | null;
  /**
   * How past worlds settled this same dilemma. Only ever attached to rounds
   * that are already decided, so it cannot inform a pending choice.
   */
  precedent: { worlds: number; yes: number; no: number } | null;
}

export type EndingTone = 'good' | 'mixed' | 'bad';

/** One finished world, kept after its epoch is wiped. */
export interface ArchivedWorld {
  n: number;
  endingKey: string;
  endingTitle: string;
  tone: EndingTone;
  /** Final AI Power — the single number that says how the world went. */
  pwr: number;
  endedAt: number;
  humans: number;
  topBloc: string | null;
}

export interface ArchiveView {
  /** The number this world will take when it ends. */
  currentWorld: number;
  worlds: ArchivedWorld[];
  /** Ending key → how many worlds ended that way, most common first. */
  tally: Array<{ key: string; title: string; tone: EndingTone; count: number }>;
  /** Median final AI Power across finished worlds, or null when there are none. */
  medianPwr: number | null;
}

/** A player's line across worlds — survives a restart. */
export interface PlayerRecord {
  worlds: number;
  ballots: number;
  withWorld: number;
}

export interface BriefingMeter {
  key: MeterKey;
  label: string;
  danger: boolean;
  before: number;
  after: number;
}

/** The overnight reveal: what yesterday's decisions actually cost. */
export interface BriefingView {
  /** The day that just began. */
  day: number;
  /** The day being reported on. */
  coveredDay: number;
  meters: BriefingMeter[];
  rounds: RoundRecord[];
}

export interface EndingView {
  key: string;
  title: string;
  verdict: string;
  tone: EndingTone;
  meters: MeterView[];
  personal: { title: string; line: string; withMajority: number; against: number; abstained: number };
  faction: { name: string; title: string; line: string } | null;
  leaderboard: Array<{ name: string; influence: number; cohesion: number; members: number }>;
  /** Where this world's final AI Power sits among the finished ones. */
  pwr: number;
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
  /** The world as of this morning — today's decisions are not reflected yet. */
  meters: MeterView[];
  /** Resolved rounds today whose impact has not been reported. */
  sealed: number;
  world: {
    card: CardView | null;
    myVote: Dir | null;
    tally: TallyView;
  };
  faction: MyFactionView | null;
  /** Set once every open decision for this round has been filed. */
  standby: boolean;
  /** Present until the player acknowledges the morning report. */
  briefing: BriefingView | null;
  history: RoundRecord[];
  ending: EndingView | null;
  /** Worlds that ended before this one. */
  archive: ArchiveView;
  /** This player's line across worlds. */
  record: PlayerRecord;
  devTools: boolean;
}

export interface ApiError {
  error: string;
}
