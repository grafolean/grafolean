import React from 'react';

import WidgetForm from '../WidgetForm/WidgetForm';
import withKnownWidgetTypes from '../DashboardView/withKnownWidgetTypes';

class DashboardWidgetEdit extends React.Component {
  render() {
    const { knownWidgetTypes } = this.props;
    const { accountId, slug, widgetId } = this.props.match.params;
    return (
      <div>
        <WidgetForm
          resource={`accounts/${accountId}/dashboards/${slug}/widgets/${widgetId}`}
          editing={true}
          afterSubmitRedirectTo={`/accounts/${accountId}/dashboards/view/${slug}`}
          lockWidgetType={true}
          knownWidgetTypes={knownWidgetTypes}
        />
      </div>
    );
  }
}
export default withKnownWidgetTypes(DashboardWidgetEdit);
