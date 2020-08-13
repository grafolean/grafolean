import GLeanChartWidget from './GLeanChartWidget/GLeanChartWidget';
import LastValueWidget from './LastValueWidget/LastValueWidget';
import TopNWidget from './TopNWidget/TopNWidget';
import NetFlowNavigationWidget from './NetFlowNavigationWidget/NetFlowNavigationWidget';

import ChartForm from './GLeanChartWidget/ChartForm/ChartForm';
import LastValueForm from './LastValueWidget/LastValueForm';
import TopNWidgetForm from './TopNWidget/TopNWidgetForm';
import NetFlowNavigationWidgetForm from './NetFlowNavigationWidget/NetFlowNavigationWidgetForm';

export const KNOWN_WIDGET_TYPES = {
  chart: {
    type: 'chart',
    icon: 'area-chart',
    label: 'chart',
    widgetComponent: GLeanChartWidget,
    widgetAdditionalProps: {},
    formComponent: ChartForm,
    isHeaderWidget: false,
  },
  lastvalue: {
    type: 'lastvalue',
    icon: 'thermometer-half',
    label: 'latest value',
    widgetComponent: LastValueWidget,
    widgetAdditionalProps: {},
    formComponent: LastValueForm,
    isHeaderWidget: false,
  },
  topn: {
    type: 'topn',
    icon: 'trophy',
    label: 'top N',
    widgetComponent: TopNWidget,
    widgetAdditionalProps: {},
    formComponent: TopNWidgetForm,
    isHeaderWidget: false,
  },
  piechart: {
    type: 'piechart',
    icon: 'pie-chart',
    label: 'pie chart',
    widgetComponent: TopNWidget,
    widgetAdditionalProps: { display: 'pie' },
    formComponent: TopNWidgetForm,
    isHeaderWidget: false,
  },
  // widgets that are meant to be on the top, above others:
  netflownavigation: {
    type: 'netflownavigation',
    icon: 'wind',
    label: 'NetFlow navigation',
    widgetComponent: NetFlowNavigationWidget,
    widgetAdditionalProps: {},
    formComponent: NetFlowNavigationWidgetForm,
    isHeaderWidget: true,
  },
};

export function getKnownWidgetComponent(widgetType) {
  const widget = KNOWN_WIDGET_TYPES[widgetType];
  if (!widget) {
    return null;
  }
  return widget.widgetComponent;
}
