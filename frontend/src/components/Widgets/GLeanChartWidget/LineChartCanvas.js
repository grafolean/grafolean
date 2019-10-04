import React from 'react';

import { generateSerieColor } from './utils';

export class LineChartCanvases extends React.Component {
  CANVAS_WIDTH_PX = 1000;
  N_ADDITIONAL = 0; // n additional canvases to each of the sides

  getCanvasIntervals() {
    // each canvas covers a smaller part of the whole area, and we draw each one of them with a separate transform:
    const { fromTs, toTs, scale } = this.props;
    // the width of each canvas influences the timespan we draw on each of the canvases:
    const diffTs = Math.round(this.CANVAS_WIDTH_PX / scale);

    let result = [];
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

  render() {
    const { fromTs, toTs, ...rest } = this.props;
    const canvasIntervals = this.getCanvasIntervals();
    return (
      <>
        {canvasIntervals.map(ci => (
          <g
            key={ci.fromTsCanvas}
            transform={`translate(${(ci.fromTsCanvas - fromTs) * this.props.scale} 0)`}
          >
            <LineChartSingleCanvas {...rest} timeFrom={ci.fromTsCanvas} timeTo={ci.toTsCanvas} />
          </g>
        ))}
      </>
    );
  }
}

class LineChartSingleCanvas extends React.PureComponent {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    this.canvasContext = this.canvasRef.current.getContext('2d');
    this.drawOnCanvas();
  }

  componentDidUpdate() {
    this.drawOnCanvas();
  }

  drawOnCanvas() {
    const ctx = this.canvasContext;
    const { timeFrom, scale } = this.props;
    const ts2x = ts => (ts - timeFrom) * scale;
    ctx.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
    // debugging:
    // ctx.strokeStyle = `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, 0)}`; // random color
    // ctx.rect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
    // ctx.stroke();
    this.props.drawnChartSeries.forEach(cs => {
      this.props.intervals.forEach(interval => {
        if (!interval.csData.hasOwnProperty(cs.chartSerieId)) {
          return;
        }
        const v2y = this.props.yAxesProperties[cs.unit].derived.v2y;
        const pathPoints = interval.csData[cs.chartSerieId].map(p => ({
          x: ts2x(p.t),
          y: v2y(p.v),
          minY: v2y(p.minv),
          maxY: v2y(p.maxv),
        }));
        //pathPoints.sort((a, b) => (a.x < b.x ? -1 : 1)); // seems like the points weren't sorted by now... we should fix this properly
        const linePoints = pathPoints.map(p => `${p.x},${p.y}`);
        const areaMinPoints = pathPoints.map(p => `${p.x},${p.minY}`);
        const areaMaxPointsReversed = pathPoints.map(p => `${p.x},${p.maxY}`).reverse();
        const serieColor = generateSerieColor(cs.path, cs.index);
        ctx.strokeStyle = serieColor;
        ctx.fillStyle = serieColor;

        if (this.props.isAggr) {
          ctx.beginPath();
          ctx.globalAlpha = 0.2;
          const areaPath = new Path2D(`M${areaMinPoints.join('L')}L${areaMaxPointsReversed}Z`);
          ctx.fill(areaPath);
          ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        const linePath = new Path2D(`M${linePoints.join('L')}`);
        ctx.stroke(linePath);

        pathPoints.forEach(p => {
          ctx.beginPath();
          ctx.lineWidth = 0;
          ctx.arc(p.x, p.y, 1, 0, 2 * Math.PI);
          ctx.fill();
        });
      });
    });
  }

  render() {
    const { timeFrom, timeTo, scale, height } = this.props;
    const width = Math.round((timeTo - timeFrom) * scale);
    return (
      <foreignObject width={width} height={height}>
        <canvas ref={this.canvasRef} width={width} height={height} />
      </foreignObject>
    );
  }
}
