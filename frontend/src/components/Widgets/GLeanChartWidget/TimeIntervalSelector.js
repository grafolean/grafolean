import React from 'react';
import moment from 'moment';

import Button from '../../Button';

export default class TimeIntervalSelector extends React.PureComponent {
  static defaultProps = {
    options: {
      '1y': moment.duration(1, 'year'),
      '3m': moment.duration(3, 'month'),
      '1m': moment.duration(1, 'month'),
      '7d': moment.duration(7, 'day'),
      '24h': moment.duration(24, 'hour'),
      '12h': moment.duration(12, 'hour'),
      '3h': moment.duration(3, 'hour'),
      '30min': moment.duration(30, 'minute'),
    },
  };

  handleButtonClick = ev => {
    ev.preventDefault();
    const optionKey = ev.target.attributes.datakey.value;
    this.props.onChange(this.props.options[optionKey]);
  };

  render() {
    const { options, style } = this.props;
    return (
      <div className="time-interval-selector" style={style}>
        Last:
        {Object.keys(options).map(k => (
          <Button key={k} datakey={k} onClick={this.handleButtonClick}>
            {k}
          </Button>
        ))}
      </div>
    );
  }
}
