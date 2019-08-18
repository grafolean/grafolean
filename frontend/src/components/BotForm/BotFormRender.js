import React from 'react';

import isForm from '../isForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';

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
      formValues: { name = '', protocol = '' },
    } = this.props;
    return (
      <>
        <div className="field">
          <label>Name:</label>
          <input type="text" name="name" value={name} onChange={this.handleInputChange} />
        </div>
        <div className="field">
          <label>Bot type:</label>
          <select value={protocol} name="protocol" onChange={this.handleInputChange}>
            <option value="">Custom</option>
            {SUPPORTED_PROTOCOLS.map(protocol => (
              <option key={protocol.slug} value={protocol.slug}>
                {protocol.label}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }
}
export default isForm(BotFormRender);
