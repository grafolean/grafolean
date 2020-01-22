import React from 'react';
import WidgetForm from '../WidgetForm/WidgetForm';

export default class DashboardWidgetEdit extends React.Component {
  render() {
    const { accountId, slug, widgetId } = this.props.match.params;
    return (
      <div>
        <WidgetForm
          resource={`accounts/${accountId}/dashboards/${slug}/widgets/${widgetId}`}
          editing={true}
          afterSubmitRedirectTo={`/accounts/${accountId}/dashboards/view/${slug}`}
          lockWidgetType={true}
        />
      </div>
    );
  }
}
