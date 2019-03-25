import React from 'react';

import './XAxisTick.scss';

export default class XAxisTick extends React.Component {
  render() {
    const { isMajor, x, label, isInterval } = this.props;
    const tickSize = isMajor ? (isInterval ? 10 : 5) : 3;
    return (
      <g>
        <line className={`${isMajor ? 'major' : 'minor'}-tick`} x1={x} y1={0} x2={x} y2={tickSize} />
        {label && (
          <text className={`label ${isInterval ? 'interval' : 'point'}`} x={isInterval ? x + 5 : x} y={18}>
            {label}
          </text>
        )}
      </g>
    );
  }
}
