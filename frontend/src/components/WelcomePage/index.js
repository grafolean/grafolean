import React from 'react';

export default class WelcomePage extends React.PureComponent {
  render() {
    // const padding = 40;
    // const halfColumnWidth = this.props.innerWidth / 2 - padding;
    return (
      <div>
        <h3>Welcome!</h3>
        <p>
          This page displays information about the latest values received and provides guidance on how to post
          these values.
        </p>
        {/* <GLeanChartWidget
          width={halfColumnWidth}
          height={400}
          widgetId={'number-of-last-values-chart'}
          dashboardSlug={null}
          title="Number of posted values"
          chartContent={[]}
          onWidgetDelete={this.fetchDashboardDetails}
        /> */}
      </div>
    );
  }
}
