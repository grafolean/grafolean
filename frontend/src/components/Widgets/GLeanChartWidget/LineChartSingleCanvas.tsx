import React, { ReactNode } from 'react';
import { ChartSerie } from './ChartView';

import { generateSerieColor } from './utils';

export type ChartType = 'line' | 'linefill' | 'point';

export const CHART_TYPE_LINE = 'line';
export const CHART_TYPE_LINEFILL = 'linefill';
export const CHART_TYPE_POINT = 'point';
export const KNOWN_CHART_TYPES = [CHART_TYPE_LINE, CHART_TYPE_POINT, CHART_TYPE_LINEFILL];
export const KNOWN_CHART_TYPES_NAMES = ['line chart', 'point chart', 'filled line chart'];

interface LineChartSingleCanvasProps {
  fromTs: number;
  toTs: number;
  scale: number;
  height: number;
  chartType: ChartType;
  drawnChartSeries: ChartSerie[];
  intervals: any;
  yAxesProperties: any;
  isAggr: boolean;
}

class LineChartSingleCanvas extends React.PureComponent<LineChartSingleCanvasProps> {
  canvasRef = React.createRef<HTMLCanvasElement>();
  canvasContext: CanvasRenderingContext2D | null = null;

  componentDidMount(): void {
    this.drawOnCanvas();
  }

  componentDidUpdate(): void {
    this.drawOnCanvas();
  }

  drawOnCanvas(): void {
    if (!this.canvasContext) {
      if (!this.canvasRef || !this.canvasRef.current) {
        return;
      }
      this.canvasContext = this.canvasRef.current.getContext('2d');
    }
    if (!this.canvasContext || !this.canvasRef || !this.canvasRef.current) {
      return;
    }

    const { chartType = CHART_TYPE_LINE } = this.props;
    const ctx = this.canvasContext;
    const { fromTs, scale } = this.props;
    const ts2x = (ts: number): number => (ts - fromTs) * scale;
    const { width, height } = this.canvasRef.current;
    ctx.clearRect(0, 0, width, height);
    // debugging:
    // ctx.strokeStyle = `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, 0)}`; // random color
    // ctx.rect(0, 0, width, height);
    // ctx.stroke();
    this.props.drawnChartSeries.forEach(cs => {
      const serieColor = generateSerieColor(cs.path, cs.index);
      ctx.strokeStyle = serieColor;
      ctx.fillStyle = serieColor;

      this.props.intervals.forEach((interval: any) => {
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
        const pathPoints = interval.csData[cs.chartSerieId].map((p: any) => ({
          x: ts2x(p.t),
          y: v2y(p.v),
          minY: v2y(p.minv),
          maxY: v2y(p.maxv),
        }));

        // single point behaves like it's a point chart:
        if (chartType === CHART_TYPE_POINT || pathPoints.length === 1) {
          ctx.lineWidth = 0;
          pathPoints.forEach((p: any) => {
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
            ctx.lineTo(lastPathPoint.x, height);
            ctx.lineTo(pathPoints[0].x, height);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }
      });
    });
  }

  render(): ReactNode {
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
