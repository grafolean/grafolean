import React from 'react';

class AdjusterMark extends React.PureComponent {
  state = {
    y: this.props.y,
  };
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
    this.setState({
      dragging: false,
      y: this.props.y + diffY,
    });
  };

  render() {
    const { x } = this.props;
    const { y } = this.state;
    const A = 4;
    const B = 2;
    return (
      <path
        d={`M${x},${y} l${-A},${A} l${-B},0 l0,${-2 * A} l${+B - 1 /* why -1? who knows... */},0 l${A},${A}`}
        onPointerDown={this.startDrag}
        onPointerUp={this.endDrag}
        onPointerCancel={this.endDrag}
        onPointerMoveCapture={this.moveDrag}
      />
    );
  }
}

export default class YAxisMinMaxAdjuster extends React.PureComponent {
  render() {
    const { x, v2y, defaultMinYValue, defaultMaxYValue } = this.props;
    return (
      <g className="yaxis-minmax-adjuster">
        <AdjusterMark x={Math.round(x)} y={Math.round(v2y(defaultMinYValue))} />
        <AdjusterMark x={Math.round(x)} y={Math.round(v2y(defaultMaxYValue))} />
      </g>
    );
  }
}
