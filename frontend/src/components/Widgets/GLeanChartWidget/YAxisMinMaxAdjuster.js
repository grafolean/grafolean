import React from 'react';

export class AdjusterMark extends React.PureComponent {
  static defaultProps = {
    startY: 10,
    x: 10,
    shadowWidth: 200,
    topLimit: 10,
    bottomLimit: 100,
  };
  state = {
    handleY: this.props.startY,
  };

  dragging = false;
  initialPageY = null;

  startDrag = ev => {
    this.dragging = true;
    this.initialPageY = ev.pageY;
    // make sure we follow the pointermove events, even if they are not over our component:
    ev.target.setPointerCapture(ev.pointerId);
  };

  endDrag = () => {
    this.dragging = false;
    this.props.onChangeEnd(this.state.handleY);
    this.setState({
      handleY: this.props.startY,
    });
  };

  moveDrag = ev => {
    if (!this.dragging) {
      return;
    }
    const { bottomLimit, topLimit } = this.props;
    const newY = this.props.startY + ev.pageY - this.initialPageY;
    this.setState(({ y }) => ({
      handleY: Math.min(bottomLimit, Math.max(topLimit, newY)),
    }));
  };

  render() {
    const { x, startY, shadowWidth } = this.props;
    const { handleY } = this.state;
    const A = 4; // half of mark height
    const B = 2; // width of rectangle
    return (
      <>
        {this.dragging && (
          <rect x={x} y={Math.min(handleY, startY)} width={shadowWidth} height={Math.abs(handleY - startY)} />
        )}
        <path
          d={`M${x},${handleY} l${-A},${A} l${-B},0 l0,${-2 * A} l${+B},0 l${A},${A}`}
          onPointerDown={this.startDrag}
          onPointerUp={this.endDrag}
          onPointerCancel={this.endDrag}
          onPointerMoveCapture={this.moveDrag}
        />
      </>
    );
  }
}

export default class YAxisMinMaxAdjuster extends React.PureComponent {
  static defaultProps = {
    minYDiff: 10,
    defaultMinYValue: null,
    defaultMaxYValue: null,
    v2y: () => {},
    x: null,
  };
  minY = this.props.v2y(this.props.defaultMinYValue);
  maxY = this.props.v2y(this.props.defaultMaxYValue);

  render() {
    const { x, shadowWidth } = this.props;
    return (
      <g className="yaxis-minmax-adjuster">
        <AdjusterMark
          startY={this.maxY}
          x={x}
          shadowWidth={shadowWidth}
          topLimit={this.maxY}
          bottomLimit={this.minY - 10}
          onChangeEnd={this.props.onMaxYChange}
        />
        <AdjusterMark
          startY={this.minY}
          x={x}
          shadowWidth={shadowWidth}
          topLimit={this.maxY + 10}
          bottomLimit={this.minY}
          onChangeEnd={this.props.onMinYChange}
        />
      </g>
    );
  }
}
