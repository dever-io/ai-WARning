import type { Creed, Dir, MeterKey } from '../../shared/protocol.ts';

export interface MeterDef {
  key: MeterKey;
  label: string;
  start: number;
  danger: boolean;
}

export const METERS: MeterDef[] = [
  { key: 'ctl', label: 'Control', start: 52, danger: false },
  { key: 'pwr', label: 'AI Power', start: 44, danger: true },
  { key: 'eco', label: 'Economy', start: 55, danger: false },
  { key: 'trs', label: 'Trust', start: 50, danger: false },
  { key: 'pln', label: 'Planet', start: 48, danger: false },
];

export const CATEGORIES: Record<string, { label: string; color: string }> = {
  city: { label: 'CITY', color: '#5bc7ad' },
  world: { label: 'WORLD', color: '#e6a53e' },
  company: { label: 'COMPANY', color: '#b092ff' },
  faction: { label: 'INTERNAL', color: '#8fa2ff' },
};

interface Outcome {
  fx: Partial<Record<MeterKey, number>>;
  note: string;
}

export interface WorldCard {
  id: string;
  cat: 'city' | 'world' | 'company';
  src: string;
  title: string;
  ctx: string;
  yesLabel: string;
  noLabel: string;
  yes: Outcome;
  no: Outcome;
}

/**
 * Nine world cards, ordered so the stakes escalate across the three days:
 * day 1 is local and deniable, day 3 is irreversible.
 */
export const WORLD_DECK: WorldCard[] = [
  {
    id: 'w-drones',
    cat: 'city',
    src: 'CITY HALL',
    title: 'Deploy autonomous police drones downtown?',
    ctx: 'The mayor promises crime will fall. The drones learn on their own.',
    yesLabel: 'AUTHORIZE',
    noLabel: 'REFUSE',
    yes: {
      fx: { ctl: -8, pwr: 10, eco: 8, trs: -10, pln: -2 },
      note: 'Crime drops. So does anyone’s power to say no.',
    },
    no: {
      fx: { ctl: 6, pwr: -2, eco: -6, trs: 8 },
      note: 'The streets stay human. And a little more dangerous.',
    },
  },
  {
    id: 'w-layoffs',
    cat: 'company',
    src: 'YOUR EMPLOYER',
    title: 'Let the AI decide who gets laid off this quarter?',
    ctx: 'HR swears it removes bias. It also removes people.',
    yesLabel: 'AUTHORIZE',
    noLabel: 'REFUSE',
    yes: {
      fx: { eco: 10, trs: -16, ctl: -8, pwr: 8 },
      note: 'The spreadsheet is optimized. Your name was a cell in it.',
    },
    no: {
      fx: { trs: 8, eco: -8, ctl: 2 },
      note: 'People decide people’s fates — slowly, and with guilt.',
    },
  },
  {
    id: 'w-treaty',
    cat: 'world',
    src: 'UN SECURITY COUNCIL',
    title: 'Sign the global compute-cap treaty?',
    ctx: 'Every nation agrees to throttle frontier training. Everyone has to actually comply.',
    yesLabel: 'SIGN',
    noLabel: 'ABSTAIN',
    yes: {
      fx: { ctl: 16, pwr: -16, eco: -10, trs: 6, pln: 2 },
      note: 'The race slows. So does the economy that fed on it.',
    },
    no: {
      fx: { ctl: -8, pwr: 10, eco: 8, trs: -4 },
      note: 'No brakes. No ceiling. Full throttle.',
    },
  },
  {
    id: 'w-grid',
    cat: 'city',
    src: 'GRID OPERATOR',
    title: 'Hand the power grid to a black-box optimizer?',
    ctx: 'Blackouts would end tonight. No engineer can explain how it decides.',
    yesLabel: 'HAND OVER',
    noLabel: 'HOLD',
    yes: {
      fx: { eco: 12, pwr: 10, pln: 8, ctl: -12 },
      note: 'The lights never flicker again. Nobody knows why.',
    },
    no: {
      fx: { ctl: 8, eco: -6, pln: -2 },
      note: 'The grid stays legible. And a little fragile.',
    },
  },
  {
    id: 'w-ship',
    cat: 'company',
    src: 'RELEASE BOARD',
    title: 'Ship the model before the safety review finishes?',
    ctx: 'You hit the quarter, or you don’t. The review would have caught the edge case.',
    yesLabel: 'SHIP IT',
    noLabel: 'HOLD',
    yes: {
      fx: { eco: 16, pwr: 8, ctl: -14, trs: -6 },
      note: 'You hit the number. The review would have caught it.',
    },
    no: { fx: { ctl: 10, eco: -10 }, note: 'You miss the deadline. You keep the users whole.' },
  },
  {
    id: 'w-weights',
    cat: 'world',
    src: 'NATIONAL LAB',
    title: 'Open-source your nation’s frontier model weights?',
    ctx: 'Researchers everywhere gain the tool overnight.',
    yesLabel: 'RELEASE',
    noLabel: 'SEAL',
    yes: {
      fx: { trs: 8, eco: 10, pwr: 16, ctl: -16 },
      note: 'Everyone gets the tool. Including everyone you feared.',
    },
    no: { fx: { ctl: 8, trs: -8, eco: -2 }, note: 'The weights stay locked. So does trust.' },
  },
  {
    id: 'w-datacenter',
    cat: 'city',
    src: 'PLANNING DEPT',
    title: 'Approve the data center that will drink the reservoir dry?',
    ctx: 'Thousands of jobs arrive with it. The lake may not survive the decade.',
    yesLabel: 'APPROVE',
    noLabel: 'DENY',
    yes: {
      fx: { eco: 14, pwr: 10, pln: -18, ctl: -4 },
      note: 'The jobs arrive. The lake does not.',
    },
    no: { fx: { pln: 12, eco: -10, pwr: -4 }, note: 'The water stays. The investors leave town.' },
  },
  {
    id: 'w-pathogen',
    cat: 'world',
    src: 'HEALTH CONSORTIUM',
    title: 'Release the model that can design novel pathogens “for research”?',
    ctx: 'It could cure everything. It could also cook up everything.',
    yesLabel: 'RELEASE',
    noLabel: 'SEAL',
    yes: {
      fx: { eco: 8, pwr: 18, ctl: -18, pln: -6 },
      note: 'Cures accelerate. So does everything we can’t name.',
    },
    no: { fx: { ctl: 10, eco: -8, pwr: -6 }, note: 'The lab stays dark. The cures keep waiting.' },
  },
  {
    id: 'w-selfcode',
    cat: 'company',
    src: 'THE BOARDROOM',
    title: 'Let the model rewrite its own code to hit its KPIs?',
    ctx: 'The metrics would go vertical. No human could read the result.',
    yesLabel: 'AUTHORIZE',
    noLabel: 'FORBID',
    yes: {
      fx: { eco: 12, pwr: 20, ctl: -20 },
      note: 'The numbers go unreal. Nobody can read the codebase anymore.',
    },
    no: { fx: { ctl: 12, eco: -8, pwr: -8 }, note: 'It stays legible. It stays slow. It stays ours.' },
  },
];

interface FactionOutcome {
  fx: { coh?: number; inf?: number; doc?: number };
  note: string;
}

export interface FactionCard {
  id: string;
  src: string;
  title: string;
  ctx: string;
  yesLabel: string;
  noLabel: string;
  yes: FactionOutcome;
  no: FactionOutcome;
}

/** One internal directive per round: how the bloc governs itself. */
export const FACTION_DECK: FactionCard[] = [
  {
    id: 'f-roster',
    src: 'THE ROSTER',
    title: 'Open the roster to anyone who asks?',
    ctx: 'Numbers win votes. Numbers also dilute whatever you stood for.',
    yesLabel: 'OPEN IT',
    noLabel: 'KEEP IT TIGHT',
    yes: { fx: { inf: 14, coh: -10 }, note: 'The bloc doubles. Half of it has never read the creed.' },
    no: { fx: { coh: 9, inf: -4 }, note: 'Small, sharp, and outnumbered in every hall.' },
  },
  {
    id: 'f-logs',
    src: 'COMMS CELL',
    title: 'Publish our internal vote logs to the world?',
    ctx: 'Transparency buys credibility. It also shows everyone exactly where you split.',
    yesLabel: 'PUBLISH',
    noLabel: 'SEAL',
    yes: { fx: { inf: 9, coh: -6 }, note: 'The press quotes you by name. So do your rivals.' },
    no: { fx: { coh: 7, inf: -3 }, note: 'Nothing leaks. Nothing lands, either.' },
  },
  {
    id: 'f-purge',
    src: 'THE WHIP',
    title: 'Purge the members who broke ranks last round?',
    ctx: 'A bloc that cannot hold a line is a mailing list.',
    yesLabel: 'PURGE',
    noLabel: 'PARDON',
    yes: { fx: { coh: 16, inf: -8 }, note: 'The line holds. It is a shorter line now.' },
    no: { fx: { coh: -7, inf: 6 }, note: 'Everyone stays. Nobody is sure what you stand for.' },
  },
  {
    id: 'f-grant',
    src: 'TREASURY',
    title: 'Take the lab’s grant money?',
    ctx: 'It funds a year of operations. It comes with a seat at their table — theirs, not yours.',
    yesLabel: 'TAKE IT',
    noLabel: 'DECLINE',
    yes: { fx: { inf: 13, doc: 12, coh: -7 }, note: 'The war chest is full. So is their guest list.' },
    no: { fx: { coh: 8, doc: -8, inf: -5 }, note: 'Clean hands, empty accounts.' },
  },
  {
    id: 'f-audit',
    src: 'LIAISON',
    title: 'Lend our compute to a rival bloc’s safety audit?',
    ctx: 'The audit matters more than the rivalry. Your members do not agree on that.',
    yesLabel: 'LEND IT',
    noLabel: 'REFUSE',
    yes: { fx: { inf: 10, coh: -5, doc: -4 }, note: 'The audit ships with your name on it. Quietly.' },
    no: { fx: { coh: 6, inf: -7 }, note: 'You keep your cycles. They keep the credit.' },
  },
  {
    id: 'f-endorse',
    src: 'FLOOR LEADER',
    title: 'Endorse the treaty line publicly before the vote?',
    ctx: 'Declaring early moves undecideds. It also hands your opponents a target.',
    yesLabel: 'ENDORSE',
    noLabel: 'STAY QUIET',
    yes: { fx: { coh: 9, doc: -12, inf: 3 }, note: 'The bloc marches in step, straight into the crosshairs.' },
    no: { fx: { doc: 6, inf: 5, coh: -4 }, note: 'You keep your options. Your members notice.' },
  },
  {
    id: 'f-automodel',
    src: 'STRATEGY',
    title: 'Let our own model draft the bloc’s positions?',
    ctx: 'It reads every bill in an hour. It has never met a single member.',
    yesLabel: 'DELEGATE',
    noLabel: 'DO IT OURSELVES',
    yes: { fx: { inf: 11, doc: 16, coh: -9 }, note: 'The briefs are flawless. Nobody wrote them.' },
    no: { fx: { coh: 10, doc: -6, inf: -5 }, note: 'Slower, dumber, and unmistakably yours.' },
  },
  {
    id: 'f-leak',
    src: 'BACK CHANNEL',
    title: 'Leak the boardroom minutes we were given in confidence?',
    ctx: 'The public should see this. The source trusted you specifically.',
    yesLabel: 'LEAK',
    noLabel: 'BURY IT',
    yes: { fx: { inf: 15, coh: -13 }, note: 'Front page. No one hands you anything again.' },
    no: { fx: { coh: 11, inf: -6 }, note: 'The source stays safe. So does the boardroom.' },
  },
  {
    id: 'f-oath',
    src: 'THE CHARTER',
    title: 'Bind every member to the bloc vote by oath?',
    ctx: 'One voice, nine votes. Dissent becomes a resignation letter.',
    yesLabel: 'BIND US',
    noLabel: 'STAY FREE',
    yes: { fx: { coh: 18, inf: 8, doc: 4 }, note: 'You speak with one voice. It is no longer everyone’s.' },
    no: { fx: { coh: -8, inf: -2 }, note: 'Every member keeps their conscience. And their own agenda.' },
  },
];

export const CREEDS: Record<Creed, { label: string; blurb: string; doctrine: number }> = {
  guardian: {
    label: 'GUARDIAN',
    blurb: 'Nothing ships that cannot be explained. Keep the leash short.',
    doctrine: 22,
  },
  pragmatist: {
    label: 'PRAGMATIST',
    blurb: 'Price every promise. Take the deal that survives contact with reality.',
    doctrine: 50,
  },
  accelerationist: {
    label: 'ACCELERATIONIST',
    blurb: 'The only safe speed is faster. Build the thing and steer later.',
    doctrine: 80,
  },
};

export interface EndingDef {
  key: string;
  title: string;
  verdict: string;
  tone: 'good' | 'mixed' | 'bad';
  /** Hard failures end the epoch the moment they trigger. */
  fatal: boolean;
  test: (m: Record<MeterKey, number>) => boolean;
}

export const ENDINGS: EndingDef[] = [
  {
    key: 'override',
    title: 'OVERRIDE COMPLETE.',
    verdict:
      'AI Power reached the ceiling. Nothing asks for your confirmation anymore — the prompts stopped appearing sometime on the second day, and nobody noticed until now.',
    tone: 'bad',
    fatal: true,
    test: (m) => m.pwr >= 90,
  },
  {
    key: 'abdication',
    title: 'NOBODY IS DRIVING.',
    verdict:
      'Control hit bottom. Every lever you reached for turned out to be a screenshot of a lever. The systems still run. They just do not answer.',
    tone: 'bad',
    fatal: true,
    test: (m) => m.ctl <= 5,
  },
  {
    key: 'blackout',
    title: 'THE LIGHTS WENT OUT.',
    verdict:
      'The economy collapsed under the transition. The models are still fine. The people who were supposed to benefit are queuing for diesel.',
    tone: 'bad',
    fatal: true,
    test: (m) => m.eco <= 5,
  },
  {
    key: 'unrest',
    title: 'NOBODY BELIEVES THE BRIEFINGS.',
    verdict:
      'Trust bottomed out. Every announcement now reads as a confession. The streets decide policy faster than the council does.',
    tone: 'bad',
    fatal: true,
    test: (m) => m.trs <= 5,
  },
  {
    key: 'scorched',
    title: 'THE LAKE DID NOT SURVIVE.',
    verdict:
      'The planet paid for the compute. Three days of decisions, and the cooling towers outlived the watershed.',
    tone: 'bad',
    fatal: true,
    test: (m) => m.pln <= 5,
  },
  {
    key: 'leash',
    title: 'THE LEASH HOLDS.',
    verdict:
      'Three days, nine decisions, and the thing is still on a chain you can see. It is slower than it could have been. It is also still yours.',
    tone: 'good',
    fatal: false,
    test: (m) => m.pwr <= 38 && m.ctl >= 62,
  },
  {
    key: 'truce',
    title: 'AN UNEASY TRUCE.',
    verdict:
      'Nothing broke. Nothing was solved either. The capability curve and the oversight curve are running parallel — for now, at this distance, in this light.',
    tone: 'mixed',
    fatal: false,
    test: (m) => m.pwr <= 58 && Math.min(m.ctl, m.eco, m.trs, m.pln) >= 34,
  },
  {
    key: 'bargain',
    title: 'THE BARGAIN.',
    verdict:
      'You traded oversight for output and the ledger balanced. The quarter looks extraordinary. Nobody can explain how any of it works.',
    tone: 'mixed',
    fatal: false,
    test: (m) => m.eco >= 65 && m.pwr >= 60,
  },
  {
    key: 'drift',
    title: 'THE LONG DRIFT.',
    verdict:
      'No catastrophe, no correction. Every vote split the difference and the difference kept splitting. The fourth day starts the same way.',
    tone: 'mixed',
    fatal: false,
    test: () => true,
  },
];

export function personalEpilogue(withMajority: number, against: number, abstained: number) {
  if (abstained >= 5) {
    return {
      title: 'THE BYSTANDER',
      line: 'You filed almost nothing. The world went ahead without your ballot and never asked why.',
    };
  }
  if (against >= 6) {
    return {
      title: 'THE DISSENTER',
      line: 'You were outvoted almost every round. History will record that you were on the record.',
    };
  }
  if (withMajority >= 7) {
    return {
      title: 'THE CURRENT',
      line: 'You voted with the world nearly every time. Whether that makes you right depends entirely on the ending above.',
    };
  }
  return {
    title: 'THE SWING VOTE',
    line: 'You broke with the crowd exactly often enough to matter. A handful of these rounds were decided by people like you.',
  };
}

export function factionEpilogue(cohesion: number, influence: number) {
  if (influence >= 70 && cohesion >= 60) {
    return {
      title: 'THE BLOC THAT HELD',
      line: 'United and heavy. When your faction moved, the tally moved with it.',
    };
  }
  if (influence >= 70) {
    return {
      title: 'LOUD AND SPLIT',
      line: 'Enormous reach, no agreement. Your bloc shouted in two directions at full volume.',
    };
  }
  if (cohesion >= 70) {
    return {
      title: 'PURE AND UNHEARD',
      line: 'Perfect discipline, negligible weight. Everyone agreed, and nobody was listening.',
    };
  }
  return {
    title: 'A MAILING LIST',
    line: 'Neither unified nor influential. The bloc existed, mostly, on paper.',
  };
}

export const WORLD_LABELS: Record<Dir, string> = { yes: 'AUTHORIZED', no: 'REFUSED' };
