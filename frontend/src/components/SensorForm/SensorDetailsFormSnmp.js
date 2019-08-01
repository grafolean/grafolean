import React from 'react';

export default class SensorDetailsFormSnmp extends React.Component {
  DEFAULT_VALUES = {
    version: '',
    snmpv12_community: '',
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
      value: { version = 'snmpv12' },
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Test:</label>
          <select value={version} name="version" onChange={this.handleChangeEventOnInput}>
            <option value="">-- please select --</option>
            <option value="option1">option1</option>
            <option value="option2">option2</option>
          </select>
        </div>
      </div>
    );
  }
}
