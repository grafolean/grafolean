import React from 'react';
import moment from 'moment';

export default class When extends React.Component {
  static defaultProps = {
    limits: {
      5: '< 5 s',
      10: '< 10 s',
      20: '< 20 s',
      30: '< 30 s',
      60: '< 1 min',
      120: '< 2 min',
      180: '< 3 min',
      300: '< 5 min',
      600: '< 10 min',
      1200: '< 20 min',
      1800: '< 30 min',
      2700: '< 45 min',
      3600: '< 1 h',
      7200: '< 2 h',
      21600: '< 6 h',
      43200: '< 12 h',
      86400: '< 1 day',
      172800: '< 2 days',
      604800: '< 1 week',
      1209600: '< 2 weeks',
      2592000: '< 30 days',
      5184000: '< 60 days',
      7776000: '< 90 days',
    },
  };
  timeoutHandle = null;

  componentWillUnmount() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  }

  registerUpdateTimeout = waitS => {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    // when limit is reached, trigger a forced update:
    setTimeout(() => {
      this.forceUpdate();
      this.timeoutHandle = null;
    }, waitS * 1000);
  };

  render() {
    const { limits, t } = this.props;
    const now = moment.utc().unix();
    const diff = now - t;
    const limit = Object.keys(limits).find(l => l > diff);
    this.registerUpdateTimeout(limit - diff + 1);
    return (
      <span className="when">
        {limit ? `${limits[limit]} ago` : `at ${moment(t * 1000).format('YYYY-MM-DD HH:mm:ss')}`}
      </span>
    );
  }
}
