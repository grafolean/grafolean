import React from 'react';

export default class EntityDetailsForm extends React.Component {
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
    const {
      entityType,
      value: { ipv4 = '' },
    } = this.props;

    if (entityType !== 'device') {
      return null; // only devices are currently supported
    }

    return (
      <div className="nested-field">
        <div className="field">
          <label>IPv4:</label>
          <input type="text" value={ipv4} name="ipv4" onChange={this.handleChangeEventOnInput} />
        </div>
      </div>
    );
  }
}
