
function suggestChartAggregationLevel(fromTs, toTs, maxPoints=100) {
    /*
      given from/to selected on the chart and maximum number of data points one wished to display,
      this function calculates the aggregation level. Note that maxPoints is not a guarantee, just
      a suggestion.
    */
    const MAX_AGGR_LEVEL = 6;
    let nHours = Math.ceil((toTs - fromTs) / 3600.0);

    for (let i = -1; i < MAX_AGGR_LEVEL; i++) {
      if (nHours / Math.pow(3, i) <= maxPoints) {
        return ( (i == -1) ? ('no') : (i.toString()) );
      }
    }
    return MAX_AGGR_LEVEL.toString();
  }
