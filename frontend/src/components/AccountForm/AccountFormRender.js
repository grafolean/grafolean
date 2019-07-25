import React from 'react';

import isForm from '../isForm';

class AccountFormRender extends React.Component {
  areFormValuesValid() {
    const { name = '' } = this.props.formValues;
    if (name.length === 0) {
      return false;
    }
    return true;
  }

  performValidation = () => {
    const valid = this.areFormValuesValid();
    this.props.onValidChange(valid);
  };

  handleInputChange = ev => {
    this.props.onInputChangeEvent(ev);
    this.performValidation();
  };

  render() {
    const {
      formValues: { name = '' },
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Account name:</label>
          <input
            type="text"
            value={name}
            name="name"
            onChange={this.handleInputChange}
            onBlur={this.performValidation}
          />
        </div>
      </div>
    );
  }
}

export default isForm(AccountFormRender);
