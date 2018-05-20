import seedrandom from 'seedrandom';

export const MAX_AGGR_LEVEL = 6;

export const getSuggestedAggrLevel = (fromTs, toTs, maxPoints=50) => {
  // returns -1 for no aggregation, aggr. level otherwise
  let nHours = Math.ceil((toTs - fromTs) / 3600.0);
  for (let l=-1; l<MAX_AGGR_LEVEL; l++) {
    if (maxPoints >= nHours / (3**l)) {
      return l;
    };
  };
  return MAX_AGGR_LEVEL;
};

export const getMissingIntervals = (existingIntervals, wantedInterval) => {
  let wantedIntervals = [ wantedInterval ];
  for (let existingInterval of existingIntervals) {
    wantedIntervals = wantedIntervals.reduce((newWantedIntervals, wantedInterval) => {
      // punch the holes into wantedInterval with each existingInterval:
      if ((existingInterval.toTs <= wantedInterval.fromTs) || (existingInterval.fromTs >= wantedInterval.toTs)) {
        newWantedIntervals.push(wantedInterval);
        return newWantedIntervals;  // no intersection - wantedInterval is unchanged
      };
      // there is intersection; we don't know the extent of it, but if there is a part over each edge, add a new interval for it:
      if (wantedInterval.fromTs < existingInterval.fromTs) {
        newWantedIntervals.push({fromTs: wantedInterval.fromTs, toTs: existingInterval.fromTs});
      };
      if (existingInterval.toTs < wantedInterval.toTs) {
        newWantedIntervals.push({fromTs: existingInterval.toTs, toTs: wantedInterval.toTs});
      };
      return newWantedIntervals;
    }, []);
  }
  return wantedIntervals;
}

const GOOGLE_CHART_COLOR_LIST = [
  '#3366CC',
  '#DC3912',
  '#FF9900',
  '#109618',
  '#990099',
  '#3B3EAC',
  '#0099C6',
  '#DD4477',
  '#66AA00',
  '#B82E2E',
  '#316395',
  '#994499',
  '#22AA99',
  '#AAAA11',
  '#6633CC',
  '#E67300',
  '#8B0707',
  '#329262',
  '#5574A6',
  '#3B3EAC',
]
export const generateSerieColor = (path, index=null) => {
  // if index is not defined, use the random generator - which doesn't work quite as well as curated lists
  if (index === null) {
    var rng = seedrandom(path);
    return `hsl(${rng() * 255}, 100%, 50%)`;
  }

  return GOOGLE_CHART_COLOR_LIST[index % GOOGLE_CHART_COLOR_LIST.length];
};
