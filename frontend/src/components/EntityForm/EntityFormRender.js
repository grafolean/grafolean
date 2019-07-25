import React from 'react';

import EntityDetailsForm from './EntityDetailsForm';
import isForm from '../isForm';

class EntityFormRender extends React.Component {
  areFormValuesValid() {
    const {
      formValues: { name = '', entity_type = '' },
    } = this.props;
    if (name.length === 0 || entity_type.length === 0) {
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

  handleDetailsChange = details => {
    this.props.onInputChange('details', details);
    this.performValidation();
  };

  render() {
    const {
      formValues: { name = '', entity_type = '', details = {} },
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            name="name"
            onChange={this.handleInputChange}
            onBlur={this.performValidation}
          />
        </div>
        <div className="field">
          <label>Monitored entity type:</label>
          <select
            value={entity_type}
            name="entity_type"
            onChange={this.handleInputChange}
            onBlur={this.performValidation}
          >
            <option value="">-- please select entity type --</option>
            <option value="device">Device</option>
          </select>
        </div>
        {entity_type && (
          <EntityDetailsForm entityType={entity_type} value={details} onChange={this.handleDetailsChange} />
        )}
      </div>
    );
  }
}

export default isForm(EntityFormRender);
