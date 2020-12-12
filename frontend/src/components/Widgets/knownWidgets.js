import GLeanChartWidget from './GLeanChartWidget/GLeanChartWidget';
import LastValueWidget from './LastValueWidget/LastValueWidget';
import TopNWidget from './TopNWidget/TopNWidget';
import NetFlowNavigationWidget from './NetFlowNavigationWidget/NetFlowNavigationWidget';

import ChartForm from './GLeanChartWidget/ChartForm/ChartForm';
import LastValueForm from './LastValueWidget/LastValueForm';
import TopNWidgetForm from './TopNWidget/TopNWidgetForm';
import NetFlowNavigationWidgetForm from './NetFlowNavigationWidget/NetFlowNavigationWidgetForm';

export const INITIAL_KNOWN_WIDGET_TYPES = {
  chart: {
    type: 'chart',
    icon: 'area-chart',
    label: 'chart',
    widgetComponent: GLeanChartWidget,
    widgetAdditionalProps: {},
    formComponent: ChartForm,
    formAdditionalProps: {},
    isHeaderWidget: false,
  },
  lastvalue: {
    type: 'lastvalue',
    icon: 'thermometer-half',
    label: 'latest value',
    widgetComponent: LastValueWidget,
    widgetAdditionalProps: {},
    formComponent: LastValueForm,
    formAdditionalProps: {},
    isHeaderWidget: false,
  },
  topn: {
    type: 'topn',
    icon: 'trophy',
    label: 'top N',
    widgetComponent: TopNWidget,
    widgetAdditionalProps: {},
    formComponent: TopNWidgetForm,
    formAdditionalProps: {},
    isHeaderWidget: false,
  },
  piechart: {
    type: 'piechart',
    icon: 'pie-chart',
    label: 'pie chart',
    widgetComponent: TopNWidget,
    widgetAdditionalProps: { display: 'pie' },
    formComponent: TopNWidgetForm,
    formAdditionalProps: {},
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
    formAdditionalProps: {},
    isHeaderWidget: true,
  },
};
