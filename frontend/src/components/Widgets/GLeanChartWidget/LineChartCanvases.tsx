import React from 'react';

import LineChartSingleCanvas, { LineChartSingleCanvasProps } from './LineChartSingleCanvas';

type LineChartCanvasesProps = LineChartSingleCanvasProps;

export default class LineChartCanvases extends React.Component<LineChartCanvasesProps> {
  CANVAS_WIDTH_PX = 1000;
  N_ADDITIONAL = 0; // n additional canvases to each of the sides

  getCanvasIntervals(): { fromTsCanvas: number; toTsCanvas: number }[] {
    // each canvas covers a smaller part of the whole area, and we draw each one of them with a separate transform:
    const { fromTs, toTs, scale } = this.props;
    // the width of each canvas influences the timespan we draw on each of the canvases:
    const diffTs = Math.round(this.CANVAS_WIDTH_PX / scale);

    const result = [];
    for (
      let i = Math.floor(fromTs / diffTs) - this.N_ADDITIONAL;
      i < Math.ceil(toTs / diffTs) + this.N_ADDITIONAL;
      i++
    ) {
      const fromTsCanvas = i * diffTs;
      const toTsCanvas = (i + 1) * diffTs;
      result.push({ fromTsCanvas: fromTsCanvas, toTsCanvas: toTsCanvas });
    }
    return result;
  }

  render(): React.ReactNode {
    const { fromTs, toTs, ...rest } = this.props;
    const canvasIntervals = this.getCanvasIntervals();
    return (
      <>
        {canvasIntervals.map(ci => (
          <g
            key={ci.fromTsCanvas}
            transform={`translate(${(ci.fromTsCanvas - fromTs) * this.props.scale} 0)`}
          >
            <LineChartSingleCanvas {...rest} fromTs={ci.fromTsCanvas} toTs={ci.toTsCanvas} />
          </g>
        ))}
      </>
    );
  }
}
