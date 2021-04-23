import React from 'react';
import moment from 'moment';

import TooltipPopup from '../../TooltipPopup';
import LabelFromPath from '../../LabelFromPath/LabelFromPath';

export default class ChartTooltipPopup extends React.PureComponent {
  render() {
    const { left, top, nDecimals, onTop, closest } = this.props;
    return (
      <div
        style={{
          position: 'absolute',
          left: left,
          top: top,
        }}
      >
        <TooltipPopup zIndex={onTop ? 999999 : 0}>
          <div>
            <p>
              <LabelFromPath {...closest.cs.serieNameParts} />
            </p>
            <p>{closest.cs.path}</p>
            {closest.point.minv ? (
              <p>
                {closest.point.minv.toFixed(nDecimals)} {closest.cs.unit} -{' '}
                {closest.point.maxv.toFixed(nDecimals)} {closest.cs.unit} (Ø{' '}
                {closest.point.v.toFixed(nDecimals)} {closest.cs.unit})
              </p>
            ) : (
              <p>
                Value: {closest.point.v.toFixed(nDecimals)} {closest.cs.unit}
              </p>
            )}
            <p>
              At:{' '}
              {moment(closest.point.t * 1000).format(
                closest.point.minv ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss',
              )}
            </p>
          </div>
        </TooltipPopup>
      </div>
    );
  }
}
