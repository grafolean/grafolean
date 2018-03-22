
export const MAX_AGGR_LEVEL = 6;

export const getSuggestedAggrLevel = (fromTs, toTs, maxPoints=100) => {
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
