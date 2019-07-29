import React from 'react';

export default class CredentialsDetailsFormSnmp extends React.Component {
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

  renderSnmpV12() {
    const {
      value: { snmpv12_community = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>Community:</label>
          <input
            type="text"
            value={snmpv12_community}
            name="snmpv12_community"
            onChange={this.handleChangeEventOnInput}
          />
        </div>
      </>
    );
  }

  renderSnmpV3() {
    const {
      value: { snmpv3_sth = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>v3:</label>
          <input type="text" value={snmpv3_sth} name="snmpv3_sth" onChange={this.handleChangeEventOnInput} />
        </div>
      </>
    );
  }

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
          <label>Version:</label>
          <select value={version} name="version" onChange={this.handleChangeEventOnInput}>
            <option value="">-- please select SNMP version --</option>
            <option value="snmpv12">SNMP v1/2</option>
            <option value="snmpv3">SNMP v3</option>
          </select>
        </div>
        <div className="nested-field">
          {version === 'snmpv12' ? this.renderSnmpV12() : version === 'snmpv3' ? this.renderSnmpV3() : null}
        </div>
      </div>
    );
  }
}
