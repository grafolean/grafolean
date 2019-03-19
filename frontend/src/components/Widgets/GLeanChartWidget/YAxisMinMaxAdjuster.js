import React from 'react';

class AdjusterMark extends React.PureComponent {
  initialY = this.props.y;
  dragging = false;

  startDrag = ev => {
    this.dragging = true;
    this.initialEventY = ev.pageY;
    // make sure we follow the pointermove events, even if they are not over our component:
    ev.target.setPointerCapture(ev.pointerId);
  };

  endDrag = () => {
    this.dragging = false;
  };

  moveDrag = ev => {
    if (!this.dragging) {
      return;
    }
    const diffY = ev.pageY - this.initialEventY;
    this.props.onChange(this.initialY + diffY);
  };

  render() {
    const { x, y } = this.props;
    const A = 4; // half of mark height
    const B = 2; // width of rectangle
    return (
      <path
        d={`M${x},${y} l${-A},${A} l${-B},0 l0,${-2 * A} l${+B},0 l${A},${A}`}
        onPointerDown={this.startDrag}
        onPointerUp={this.endDrag}
        onPointerCancel={this.endDrag}
        onPointerMoveCapture={this.moveDrag}
      />
    );
  }
}

export default class YAxisMinMaxAdjuster extends React.PureComponent {
  static defaultProps = {
    minYDiff: 10,
    defaultMinYValue: 0,
    defaultMaxYValue: 10,
    v2y: v => null,
    x: 0,
  };
  state = {
    minY: this.props.v2y(this.props.defaultMinYValue),
    maxY: this.props.v2y(this.props.defaultMaxYValue),
    adjusting: false,
  };

  adjustStart = () => {
    this.setState({ adjusting: true });
  };
  adjustEnd = () => {
    this.setState({ adjusting: false });
  };
  changeMinY = y => {
    const { v2y, defaultMinYValue, minYDiff } = this.props;
    this.setState(({ maxY }) => ({
      minY: Math.min(v2y(defaultMinYValue), Math.max(maxY + minYDiff, y)),
    }));
  };
  changeMaxY = y => {
    const { v2y, defaultMaxYValue, minYDiff } = this.props;
    this.setState(({ minY }) => ({
      maxY: Math.max(v2y(defaultMaxYValue), Math.min(minY - minYDiff, y)),
    }));
  };

  render() {
    const { x } = this.props;
    const { minY, maxY } = this.state;

    return (
      <g className="yaxis-minmax-adjuster">
        <AdjusterMark
          x={x}
          y={minY}
          onDragStart={this.adjustStart}
          onChange={this.changeMinY}
          onDragEnd={this.adjustEnd}
        />
        <AdjusterMark
          x={x}
          y={maxY}
          onDragStart={this.adjustStart}
          onChange={this.changeMaxY}
          onDragEnd={this.adjustEnd}
        />
      </g>
    );
  }
}
