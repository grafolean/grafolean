import React from 'react';

export default class CredentialsDetailsFormPing extends React.Component {
  DEFAULT_VALUES = {
    n_packets: '3',
    sleep_packets: '1.0',
    timeout: '1.0',
    retry: '0',
  };

  componentDidMount() {
    this.ensureDefaultValue();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.ensureDefaultValue();
    }
  }

  ensureDefaultValue() {
    if (Object.keys(this.props.value).length === 0) {
      this.props.onChange(this.DEFAULT_VALUES);
    }
  }

  handleChangeEventOnInput = ev => {
    const fieldName = ev.target.name;
    const fieldValue = ev.target.value;
    const newValue = {
      ...this.props.value,
      [fieldName]: fieldValue,
    };
    this.props.onChange(newValue);
  };

  render() {
    if (Object.keys(this.props.value).length === 0) {
      return null;
    }

    const {
      value: { n_packets = '', sleep_packets = '', timeout = '', retry = '' },
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Number of packets:</label>
          <input type="text" value={n_packets} name="n_packets" onChange={this.handleChangeEventOnInput} />
        </div>
        <div className="field">
          <label>Time to sleep between packets:</label>
          <input
            type="text"
            value={sleep_packets}
            name="sleep_packets"
            onChange={this.handleChangeEventOnInput}
          />
        </div>
        <div className="field">
          <label>Timeout before the packet is considered lost:</label>
          <input type="text" value={timeout} name="timeout" onChange={this.handleChangeEventOnInput} />
        </div>
        <div className="field">
          <label>Number of retries for lost packets:</label>
          <input type="text" value={retry} name="retry" onChange={this.handleChangeEventOnInput} />
        </div>
      </div>
    );
  }
}
