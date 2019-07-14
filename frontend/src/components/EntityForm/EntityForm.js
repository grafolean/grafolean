import React from 'react';
import EntityFormRender from './EntityFormRender';
import { PersistentFetcher } from '../../utils/fetch';

export default class EntityForm extends React.Component {
  state = {
    initialFormValues: {
      name: '',
      entity_type: '',
      details: {},
    },
    loading: true,
    warnChangedOnServer: false,
  };

  handleEntityValuesBackendChange = initialFormValues => {
    if (!this.state.loading) {
      // oops - someone has changed the record while we are editing it! Let's warn user:
      this.setState({
        warnChangedOnServer: true,
      });
      return;
    }

    delete initialFormValues['id']; // server returns an id too, which we don't need
    this.setState({
      initialFormValues: initialFormValues,
      loading: false,
    });
  };

  render() {
    const { accountId, entityId } = this.props.match.params;
    const { warnChangedOnServer, initialFormValues, loading } = this.state;

    if (!entityId) {
      // we are creating a new entity (not editing an existing one), which is a much simpler case:
      return <EntityFormRender initialFormValues={initialFormValues} {...this.props} />;
    }

    return (
      <>
        <PersistentFetcher
          resource={`accounts/${accountId}/entities/${entityId}`}
          onUpdate={this.handleEntityValuesBackendChange}
        />
        {!loading && (
          <EntityFormRender
            recordId={entityId}
            initialFormValues={initialFormValues}
            {...this.props}
            warnChangedOnServer={warnChangedOnServer}
          />
        )}
      </>
    );
  }
}
