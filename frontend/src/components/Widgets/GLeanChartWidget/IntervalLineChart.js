import React from 'react';

import { generateSerieColor } from './utils';

export default class IntervalLineChart extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    for (let propName in this.props) {
      // this.props.v2y is anonymous function and changes every time parent rerenders, so
      // we ignore it as a signal for update:
      if (this.props[propName] !== nextProps[propName] && propName !== 'v2y') {
        return true;
      }
    }
    return false;
  }

  render() {
    const ts2x = ts => (ts - this.props.minKnownTs) * this.props.scale;
    return (
      <g>
        {/* draw every path: */}
        {this.props.drawnChartSeries.map((cs, cs_index) => {
          if (!this.props.interval.pathsData.hasOwnProperty(cs.path)) {
            return null;
          }
          const path = cs.path;
          const v2y = this.props.v2y[cs.unit];
          const pathPoints = this.props.interval.pathsData[cs.path].map(p => ({
            x: ts2x(p.t),
            y: v2y(p.v),
            minY: v2y(p.minv),
            maxY: v2y(p.maxv),
          }));
          pathPoints.sort((a, b) => (a.x < b.x ? -1 : 1)); // seems like the points weren't sorted by now... we should fix this properly
          const linePoints = pathPoints.map(p => `${p.x},${p.y}`);
          const areaMinPoints = pathPoints.map(p => `${p.x},${p.minY}`);
          const areaMaxPointsReversed = pathPoints.map(p => `${p.x},${p.maxY}`).reverse();
          const serieColor = generateSerieColor(cs.path, cs.index);
          return (
            <g key={`g-${cs_index}`}>
              <path
                d={`M${areaMinPoints.join('L')}L${areaMaxPointsReversed}`}
                style={{
                  fill: serieColor,
                  opacity: 0.2,
                  stroke: 'none',
                }}
              />
              <path
                d={`M${linePoints.join('L')}`}
                style={{
                  fill: 'none',
                  stroke: serieColor,
                }}
              />
              {true
                ? pathPoints.map((p, pi) => (
                    // points:
                    <circle
                      key={`p-${cs_index}-${pi}`}
                      cx={p.x}
                      cy={p.y}
                      r={1}
                      style={{
                        fill: serieColor,
                      }}
                    />
                  ))
                : null}
            </g>
          );
        })}
      </g>
    );
  }
}
