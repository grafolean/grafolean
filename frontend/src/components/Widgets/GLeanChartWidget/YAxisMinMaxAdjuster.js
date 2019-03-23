import React from 'react';

import './YAxisMinMaxAdjuster.scss';

export default class YAxisMinMaxAdjuster extends React.PureComponent {
  static defaultProps = {
    startY: 10,
    x: 10,
    shadowWidth: 200,
    topLimit: 10,
    bottomLimit: 100,
    onChangeEnd: () => {},
  };
  state = {
    draggedToY: null,
  };

  dragging = false; // not sure if we need this - it makes sure that moveDrag doesn't happen after endDrag
  initialPageY = null;

  startDrag = ev => {
    this.dragging = true;
    this.initialPageY = ev.pageY;
    this.setState({
      draggedToY: this.props.startY,
    });
    // make sure we follow the pointermove events, even if they are not over our component:
    ev.target.setPointerCapture(ev.pointerId);
  };

  endDrag = () => {
    this.dragging = false;
    this.props.onChangeEnd(this.state.draggedToY);
    this.setState({
      draggedToY: null,
    });
  };

  moveDrag = ev => {
    if (!this.dragging) {
      return;
    }
    const { bottomLimit, topLimit, startY } = this.props;
    const newY = startY + ev.pageY - this.initialPageY;
    this.setState({
      draggedToY: Math.min(bottomLimit, Math.max(topLimit, newY)),
    });
  };

  render() {
    const { x, startY, shadowWidth } = this.props;
    const { draggedToY } = this.state;
    const A = 4; // half of mark height
    const B = 2; // width of rectangle
    return (
      <g className="yaxis-minmax-adjuster">
        {draggedToY && (
          <rect
            x={x}
            y={Math.min(draggedToY, startY)}
            width={shadowWidth}
            height={Math.abs(draggedToY - startY)}
          />
        )}
        <path
          d={`M${x},${draggedToY ? draggedToY : startY} l${-A},${A} l${-B},0 l0,${-2 *
            A} l${+B},0 l${A},${A}`}
          onPointerDown={this.startDrag}
          onPointerUp={this.endDrag}
          onPointerCancel={this.endDrag}
          onPointerMoveCapture={this.moveDrag}
        />
      </g>
    );
  }
}
