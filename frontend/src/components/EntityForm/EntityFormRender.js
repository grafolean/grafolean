import React from 'react';

import '../form.scss';
import EntityDetailsForm from './EntityDetailsForm';
import isForm from '../isForm';

class EntityFormRender extends React.Component {
  areFormValuesValid() {
    const { name, entity_type } = this.state.formValues;
    if (name.length === 0 || entity_type.length === 0) {
      return false;
    }
    return true;
  }

  handleBlur = () => {
    this.props.onValidChange(this.areFormValuesValid());
  };

  render() {
    const {
      formValues: { name = '', entity_type = '', details = {} },
      onInputChangeEvent,
      onInputChange,
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Name:</label>
          <input type="text" value={name} name="name" onChange={onInputChangeEvent} />
        </div>
        <div className="field">
          <label>Monitored entity type:</label>
          <select value={entity_type} name="entity_type" onChange={onInputChangeEvent}>
            <option value="">-- please select entity type --</option>
            <option value="device">Device</option>
          </select>
        </div>
        {entity_type && (
          <EntityDetailsForm
            entityType={entity_type}
            value={details}
            onChange={details => onInputChange('details', details)}
          />
        )}
      </div>
    );
  }
}

export default isForm(EntityFormRender);
