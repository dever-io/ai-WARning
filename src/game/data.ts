import raw from './cards.json';
import type { GameData } from './types';

// cards.json is the design handoff's source of truth for all content.
const data = raw as unknown as GameData;

export const meterDefs = data.meters;
export const categories = data.categories;
export const deck = data.deck;
export const choicesPerDay = data.rules.choicesPerDay;
