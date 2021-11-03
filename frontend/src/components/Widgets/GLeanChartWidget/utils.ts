export const MAX_AGGR_LEVEL = 6;

export type CSSColor = string;

interface TimeInterval {
  fromTs: number;
  toTs: number;
}
interface DataPoint {
  t: number;
  v: number;
}
interface ChartSeriesData {
  [key: string]: DataPoint[];
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
];
export const generateSerieColor = (path: string, index: number): CSSColor => {
  // if index is not defined, use the random generator - which doesn't work quite as well as curated lists
  // if (index === null) {
  //   var rnd = getHash(path);
  //   return `hsl(${rnd}, 100%, 50%)`;
  // }
  return GOOGLE_CHART_COLOR_LIST[index % GOOGLE_CHART_COLOR_LIST.length];
};

const GRID_COLORS_LIGHT_MODE = ['#f0f0f0', '#e7e7e7'];
const GRID_COLORS_DARK_MODE = ['#343434', '#454545'];
export const generateGridColor = (index: number, isDarkMode: boolean): CSSColor => {
  const gridColors = isDarkMode ? GRID_COLORS_DARK_MODE : GRID_COLORS_LIGHT_MODE;
  return gridColors[index % gridColors.length];
};

export const getSuggestedAggrLevel = (
  fromTs: number,
  toTs: number,
  maxPointsAllowed: number,
  minAggrLevel: number = -1,
): number => {
  // returns -1 for no aggregation, aggr. level otherwise
  const nHours = Math.ceil((toTs - fromTs) / 3600.0);
  for (let l = minAggrLevel; l < MAX_AGGR_LEVEL; l++) {
    if (maxPointsAllowed >= nHours / 3 ** l) {
      return l;
    }
  }
  return MAX_AGGR_LEVEL;
};

export const getMissingIntervals = (
  existingIntervals: TimeInterval[],
  wantedInterval: TimeInterval,
): TimeInterval[] => {
  let wantedIntervals = [wantedInterval];
  for (const existingInterval of existingIntervals) {
    wantedIntervals = wantedIntervals.reduce((newWantedIntervals: TimeInterval[], wantedInterval) => {
      // punch the holes into wantedInterval with each existingInterval:
      if (existingInterval.toTs <= wantedInterval.fromTs || existingInterval.fromTs >= wantedInterval.toTs) {
        newWantedIntervals.push(wantedInterval);
        return newWantedIntervals; // no intersection - wantedInterval is unchanged
      }
      // there is intersection; we don't know the extent of it, but if there is a part over each edge, add a new interval for it:
      if (wantedInterval.fromTs < existingInterval.fromTs) {
        newWantedIntervals.push({
          fromTs: wantedInterval.fromTs,
          toTs: existingInterval.fromTs,
        });
      }
      if (existingInterval.toTs < wantedInterval.toTs) {
        newWantedIntervals.push({
          fromTs: existingInterval.toTs,
          toTs: wantedInterval.toTs,
        });
      }
      return newWantedIntervals;
    }, []);
  }
  return wantedIntervals;
};

export const aggregateIntervalOnTheFly = (
  fromTs: number,
  toTs: number,
  csData: ChartSeriesData,
  useAggrLevel: number,
): any => {
  const interval = Math.round(3600 * 3 ** useAggrLevel);
  const fromTsAligned = Math.floor(fromTs / interval) * interval;
  const toTsAligned = Math.ceil(toTs / interval) * interval;

  // initialize result array:
  const numberOfBuckets = Math.round((toTsAligned - fromTsAligned) / interval);
  const result: any = {};
  for (const chartSerieId in csData) {
    result[chartSerieId] = new Array(numberOfBuckets);
    for (let i = 0; i < numberOfBuckets; i++) {
      result[chartSerieId][i] = {
        sumv: 0,
        minv: Number.POSITIVE_INFINITY,
        maxv: Number.NEGATIVE_INFINITY,
        count: 0, // we need this so we can efficiently calculate new average value
      };
    }
  }

  // aggregate each of the values with correct bucket:
  for (const chartSerieId in csData) {
    for (const x of csData[chartSerieId]) {
      const bucketNo = Math.floor((x.t - fromTsAligned) / interval);
      const r = result[chartSerieId][bucketNo];
      result[chartSerieId][bucketNo] = {
        sumv: r.sumv + x.v,
        minv: Math.min(r.minv, x.v),
        maxv: Math.max(r.maxv, x.v),
        count: r.count + 1,
      };
    }
  }

  // and now set the times of the buckets too, and forget count, and calculate average value:
  for (const chartSerieId in csData) {
    for (let i = 0; i < numberOfBuckets; i++) {
      if (result[chartSerieId][i].count === 0) {
        result[chartSerieId][i] = {
          t: fromTsAligned + i * interval + interval / 2,
          v: null,
          minv: null,
          maxv: null,
        };
      } else {
        result[chartSerieId][i] = {
          t: fromTsAligned + i * interval + interval / 2,
          v: result[chartSerieId][i].sumv / result[chartSerieId][i].count,
          minv: result[chartSerieId][i].minv,
          maxv: result[chartSerieId][i].maxv,
        };
      }
    }
  }
  return result;
};
