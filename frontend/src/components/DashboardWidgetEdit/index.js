import React from 'react';
import WidgetForm from '../WidgetForm';

export default class DashboardWidgetEdit extends React.Component {

  render() {
    return (
      <div>
        <WidgetForm
          dashboardSlug={this.props.match.params.slug}
          widgetId={this.props.match.params.widgetId}
        />
      </div>
    )
  }
}

