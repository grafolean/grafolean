import React from 'react';
import SensorFormRender from './SensorFormRender';

class SensorForm extends React.Component {
  render() {
    const { accountId, sensorId } = this.props.match.params;
    const editing = Boolean(sensorId);
    const resource = editing ? `accounts/${accountId}/sensors/${sensorId}` : `accounts/${accountId}/sensors`;
    return (
      <SensorFormRender
        initialFormValues={{}}
        editing={editing}
        resource={resource}
        afterSubmitRedirectTo={`/accounts/${accountId}/sensors`}
      />
    );
  }
}
export default SensorForm;
