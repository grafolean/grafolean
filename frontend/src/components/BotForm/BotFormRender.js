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
    this.props.onValidChange(this.areFormValuesValid());
  };

  handleProtocolChange = newValue => {
    this.props.onInputChange('protocol', newValue);
    this.props.onValidChange(this.areFormValuesValid());
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
          <label>Protocol:</label>
          <span
            className={`protocol-choice ${!protocol && 'chosen'}`}
            value=""
            onClick={() => this.handleProtocolChange('')}
          >
            Custom
          </span>
          {SUPPORTED_PROTOCOLS.map(p => (
            <span
              key={p.slug}
              className={`protocol-choice ${p.slug === protocol && 'chosen'}`}
              value={p.slug}
              onClick={() => this.handleProtocolChange(p.slug)}
            >
              {p.label}
            </span>
          ))}
        </div>
      </>
    );
  }
}
export default isForm(BotFormRender);
