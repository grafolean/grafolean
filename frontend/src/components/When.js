import React from 'react';
import moment from 'moment-timezone';

const DEFAULT_LIMITS = {
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
};

export default class When extends React.Component {
  static defaultProps = {
    limits: DEFAULT_LIMITS,
  };
  state = {
    message: null,
  };
  timeoutHandle = null;

  componentDidMount() {
    this.handleTimeChange();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.t !== this.props.t) {
      this.handleTimeChange();
    }
  }

  componentWillUnmount() {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
    }
  }

  handleTimeChange = () => {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    const { t, limits } = this.props;
    const now = moment.utc().unix();
    const diff = now - t;
    const limit = Object.keys(limits).find(l => l > diff);
    const message = limit ? `${limits[limit]} ago` : `at ${moment(t * 1000).format('YYYY-MM-DD HH:mm:ss z')}`;
    this.setState({
      message: message,
    });
    // schedule next text update:
    if (!limit) {
      return;
    }
    this.timeoutHandle = setTimeout(this.handleTimeChange, (limit - diff) * 1000 + 100);
  };

  render() {
    const { message } = this.state;
    if (message === null) {
      return null;
    }
    return <span className="when">{message}</span>;
  }
}
