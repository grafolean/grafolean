import React from 'react';

import { generateSerieColor } from './utils';

export const CHART_TYPE_LINE = 'line';
export const CHART_TYPE_LINEFILL = 'linefill';
export const CHART_TYPE_POINT = 'point';
export const KNOWN_CHART_TYPES = [CHART_TYPE_LINE, CHART_TYPE_POINT, CHART_TYPE_LINEFILL];
export const KNOWN_CHART_TYPES_NAMES = ['line chart', 'point chart', 'filled line chart'];

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
    const { chartType = CHART_TYPE_LINE } = this.props;
    const ctx = this.canvasContext;
    const { fromTs, scale } = this.props;
    const ts2x = ts => (ts - fromTs) * scale;
    ctx.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
    // debugging:
    // ctx.strokeStyle = `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, 0)}`; // random color
    // ctx.rect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
    // ctx.stroke();
    this.props.drawnChartSeries.forEach(cs => {
      const serieColor = generateSerieColor(cs.path, cs.index);
      ctx.strokeStyle = serieColor;
      ctx.fillStyle = serieColor;

      this.props.intervals.forEach(interval => {
        if (!interval.csData.hasOwnProperty(cs.chartSerieId)) {
          return;
        }
        if (interval.csData[cs.chartSerieId].length === 0) {
          return; // no points
        }
        if (!this.props.yAxesProperties[cs.unit]) {
          return;
        }
        const v2y = this.props.yAxesProperties[cs.unit].derived.v2y;
        const pathPoints = interval.csData[cs.chartSerieId].map(p => ({
          x: ts2x(p.t),
          y: v2y(p.v),
          minY: v2y(p.minv),
          maxY: v2y(p.maxv),
        }));

        // single point behaves like it's a point chart:
        if (chartType === CHART_TYPE_POINT || pathPoints.length === 1) {
          ctx.lineWidth = 0;
          pathPoints.forEach(p => {
            ctx.fillRect(p.x, p.y, 2, 2);
          });
        } else {
          const firstPathPoint = pathPoints[0];
          const lastPathPoint = pathPoints[pathPoints.length - 1];
          ctx.lineWidth = 1;
          if (this.props.isAggr) {
            ctx.beginPath();
            ctx.globalAlpha = 0.2;
            ctx.moveTo(firstPathPoint.x, firstPathPoint.minY);
            for (let i = 1; i < pathPoints.length; i++) {
              ctx.lineTo(pathPoints[i].x, pathPoints[i].minY);
            }
            for (let i = pathPoints.length - 1; i >= 0; i--) {
              ctx.lineTo(pathPoints[i].x, pathPoints[i].maxY);
            }
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }

          ctx.beginPath();
          ctx.moveTo(firstPathPoint.x, firstPathPoint.y);
          for (let i = 1; i < pathPoints.length; i++) {
            ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
          }
          ctx.stroke();

          if (chartType === CHART_TYPE_LINEFILL && !this.props.isAggr) {
            ctx.beginPath();
            ctx.globalAlpha = 0.1;
            ctx.moveTo(firstPathPoint.x, firstPathPoint.y);
            for (let i = 1; i < pathPoints.length; i++) {
              ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
            }
            ctx.lineTo(lastPathPoint.x, this.canvasRef.current.height);
            ctx.lineTo(pathPoints[0].x, this.canvasRef.current.height);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }
      });
    });
  }

  render() {
    const { fromTs, toTs, scale, height } = this.props;
    const width = Math.round((toTs - fromTs) * scale);
    return (
      <foreignObject width={width} height={height}>
        <canvas ref={this.canvasRef} width={width} height={height} />
      </foreignObject>
    );
  }
}
export default LineChartSingleCanvas;
