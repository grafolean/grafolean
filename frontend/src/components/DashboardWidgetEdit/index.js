import React from 'react';
import WidgetForm from '../WidgetForm';

export default class DashboardWidgetEdit extends React.Component {
  render() {
    const { accountId, slug, widgetId } = this.props.match.params;
    return (
      <div>
        <WidgetForm
          dashboardSlug={slug}
          widgetId={widgetId}
          lockWidgetType={true}
          afterUpdateRedirectTo={`/accounts/${accountId}/dashboards/view/${slug}`}
        />
      </div>
    );
  }
}
