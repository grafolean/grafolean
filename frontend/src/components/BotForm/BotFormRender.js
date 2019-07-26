import React from 'react';

import isForm from '../isForm';

class BotFormRender extends React.Component {
  areFormValuesValid() {
    const {
      formValues: { name = '' },
    } = this.props;
    if (name.length === 0) {
      return false;
    }
    return true;
  }

  handleInputChange = ev => {
    this.props.onInputChangeEvent(ev);

    const valid = this.areFormValuesValid();
    this.props.onValidChange(valid);
  };

  render() {
    const {
      formValues: { name = '', bot_type = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>Name:</label>
          <input type="text" name="name" value={name} onChange={this.handleInputChange} />
        </div>
        <div className="field">
          <label>Bot type:</label>
          <select value={bot_type} name="bot_type" onChange={this.handleInputChange}>
            <option value="">Custom</option>
            <option value="ping">ICMP Ping</option>
            <option value="snmp">SNMP</option>
          </select>
        </div>
      </>
    );
  }
}
export default isForm(BotFormRender);
