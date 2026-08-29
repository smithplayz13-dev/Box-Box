// Driver roster for Career Timeline — current grid + legends
// driverId matches the Jolpica/Ergast API driverId

export const CAREER_DRIVERS = [
  // CURRENT GRID (2026)
  { id: 'hamilton',       name: 'Lewis Hamilton',     code: 'HAM', team: 'Ferrari',          teamColor: '#E8002D', group: 'current' },
  { id: 'max_verstappen', name: 'Max Verstappen',     code: 'VER', team: 'Red Bull Racing',  teamColor: '#3671C6', group: 'current' },
  { id: 'leclerc',       name: 'Charles Leclerc',     code: 'LEC', team: 'Ferrari',          teamColor: '#E8002D', group: 'current' },
  { id: 'norris',        name: 'Lando Norris',        code: 'NOR', team: 'McLaren',          teamColor: '#FF8000', group: 'current' },
  { id: 'alonso',        name: 'Fernando Alonso',     code: 'ALO', team: 'Aston Martin',     teamColor: '#229971', group: 'current' },
  { id: 'russell',       name: 'George Russell',      code: 'RUS', team: 'Mercedes',         teamColor: '#27F4D2', group: 'current' },
  { id: 'piastri',       name: 'Oscar Piastri',       code: 'PIA', team: 'McLaren',          teamColor: '#FF8000', group: 'current' },
  { id: 'andrea_kimi_antonelli', name: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes',      teamColor: '#27F4D2', group: 'current' },
  { id: 'hadjar',        name: 'Isack Hadjar',        code: 'HAD', team: 'RB F1 Team',       teamColor: '#6692FF', group: 'current' },
  { id: 'bearman',       name: 'Oliver Bearman',      code: 'BEA', team: 'Haas F1 Team',     teamColor: '#B6BABD', group: 'current' },

  // LEGENDS
  { id: 'michael_schumacher', name: 'Michael Schumacher', code: 'MSC', team: 'Ferrari',      teamColor: '#E8002D', group: 'legend' },
  { id: 'vettel',             name: 'Sebastian Vettel',   code: 'VET', team: 'Red Bull',      teamColor: '#3671C6', group: 'legend' },
  { id: 'raikkonen',          name: 'Kimi Räikkönen',     code: 'RAI', team: 'Ferrari',       teamColor: '#E8002D', group: 'legend' },
  { id: 'rosberg',            name: 'Nico Rosberg',       code: 'ROS', team: 'Mercedes',      teamColor: '#27F4D2', group: 'legend' },
  { id: 'button',             name: 'Jenson Button',      code: 'BUT', team: 'McLaren',       teamColor: '#FF8000', group: 'legend' },
  { id: 'prost',              name: 'Alain Prost',        code: 'PRO', team: 'Ferrari',        teamColor: '#E8002D', group: 'legend' },
  { id: 'senna',              name: 'Ayrton Senna',       code: 'SEN', team: 'McLaren',        teamColor: '#FF8000', group: 'legend' },
];

// Key career moments for timeline annotations
export const CAREER_MOMENTS = {
  hamilton: {
    '2007': 'Debut season — nearly wins the championship as a rookie',
    '2008': 'First World Championship won at Interlagos on the last corner',
    '2014': 'Dominant title win in the turbo-hybrid era with Mercedes',
    '2015': 'Back-to-back titles — 3rd World Championship',
    '2017': 'Defeats Vettel in a season-long duel for title #4',
    '2018': 'Fifth World Championship — overtakes Fangio',
    '2019': 'Sixth World Championship — one short of Schumacher',
    '2020': 'Record-equalling 7th Championship & 92 wins milestone',
    '2021': 'Controversial title loss at Abu Dhabi on the final lap',
    '2025': 'Historic switch to Ferrari after 12 years at Mercedes',
  },
  max_verstappen: {
    '2015': 'Youngest ever F1 driver at 17 years old',
    '2016': 'Youngest race winner at Spanish GP on Red Bull debut',
    '2021': 'Dramatic first World Championship at Abu Dhabi',
    '2022': 'Record-breaking 15 wins in a single season',
    '2023': 'Unprecedented 19 wins — most dominant season in F1 history',
    '2024': '4th consecutive World Championship',
  },
  michael_schumacher: {
    '1991': 'Stunning debut at Spa — qualifies 7th for Jordan',
    '1994': 'First World Championship with Benetton',
    '1995': 'Back-to-back titles — dominates with Benetton',
    '2000': "Ferrari's first driver title in 21 years",
    '2001': 'Wraps up championship with 4 races remaining',
    '2002': 'Finishes on podium every race — 17 of 17',
    '2003': '6th World Championship — equals Fangio',
    '2004': 'Record 13 wins in a single season — 7th title',
  },
  vettel: {
    '2008': 'Youngest race winner in F1 history at Monza',
    '2010': 'Youngest World Champion at 23 years old',
    '2011': 'Dominant 15 poles and 11 wins for 2nd title',
    '2012': 'Epic comeback from last to champion in Brazil',
    '2013': 'Record 9 consecutive wins to close the season — 4th title',
    '2022': 'Retirement season — emotional farewell at Abu Dhabi',
  },
  alonso: {
    '2003': 'Youngest pole sitter at Malaysian GP',
    '2005': "Youngest World Champion at 24 — ends Schumacher's reign",
    '2006': 'Back-to-back titles — defeats Schumacher again',
    '2012': 'Stunning season dragging Ferrari to 2nd — 3 points off title',
    '2023': 'Remarkable podium comeback at 41 with Aston Martin',
  },
  leclerc: {
    '2019': 'First two wins at Spa and Monza in stunning fashion',
    '2022': 'Led championship early — 3 wins in first 5 races',
  },
  norris: {
    '2021': 'First podium and near-win in Russia',
    '2024': 'First F1 victory at Miami GP — McLaren resurgence',
  },
  raikkonen: {
    '2003': 'Championship runner-up by 2 points — McLaren reliability',
    '2005': '7 wins but title heartbreak with McLaren',
    '2007': 'World Championship with Ferrari — 1 point margin',
    '2012': "Comeback season with Lotus — 'Leave me alone, I know what I'm doing'",
  },
  rosberg: {
    '2014': 'Intense Hamilton rivalry begins at Mercedes',
    '2016': 'World Championship — beats Hamilton and retires on top',
  },
  button: {
    '2006': 'First win at Hungary after 113 races of waiting',
    '2009': 'World Championship with Brawn GP — fairytale season',
    '2011': 'Stunning Canada victory from last place in the rain',
  },
  senna: {
    '1984': 'Stunning Monaco debut in the rain — announces arrival',
    '1988': 'First World Championship with McLaren — 8 wins',
    '1990': 'Second World Championship — bitter Prost rivalry',
    '1991': 'Third World Championship — dominant season',
    '1993': 'Epic wet-weather masterclass at Donington Park',
    '1994': 'Tragic weekend at Imola — lost at 34',
  },
  prost: {
    '1985': 'First World Championship with McLaren',
    '1986': 'Back-to-back titles — defeats Mansell at Adelaide',
    '1988': 'Most points in season but loses title to Senna on countback',
    '1989': 'Third World Championship — controversial Suzuka clash',
    '1993': 'Fourth and final World Championship with Williams',
  },
};

// Get moment for a specific driver and year, with generic fallback
export function getCareerMoment(driverId, year, _team) {
  const moments = CAREER_MOMENTS[driverId];
  if (moments && moments[year]) return moments[year];
  return null; // No generic fallback — keep timeline clean
}
