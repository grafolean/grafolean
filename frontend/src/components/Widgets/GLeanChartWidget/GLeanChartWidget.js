import React from 'react';
import { withRouter } from 'react-router-dom';
import moment from 'moment-timezone';

import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';

import RePinchy from '../../RePinchy';
import ZoomDebounce from '../../ZoomDebounce';
import ChartContainer from './ChartContainer';
import Legend from './Legend/Legend';
import MatchingPaths from './ChartForm/MatchingPaths';
import isWidget from '../isWidget';
import TimeIntervalSelector from './TimeIntervalSelector';

import './GLeanChartWidget.scss';

export class CoreGLeanChartWidget extends React.Component {
  state = {
    loading: true,
    drawnChartSeries: [],
    allChartSeries: [],
  };
  repinchyMouseMoveHandler = null;
  repinchyClickHandler = null;

  onPathsUpdate = json => {
    const {
      content: { series_groups: seriesGroups },
    } = this.props;
    // construct a better representation of the data for display in the chart:
    const allChartSeries = seriesGroups.reduce((result, c, seriesGroupIndex) => {
      return result.concat(
        json.paths[c.path_filter].map(p => ({
          chartSerieId: `${seriesGroupIndex}-${p.id}`,
          path: p.path,
          serieNameParts: {
            path: p.path,
            filter: c.path_filter,
            renaming: c.renaming,
          },
          expression: c.expression,
          unit: c.unit,
        })),
      );
    }, []);
    const indexedAllChartSeries = allChartSeries.map((cs, i) => ({
      ...cs,
      index: i,
    }));

    this.setState({
      drawnChartSeries: indexedAllChartSeries,
      allChartSeries: indexedAllChartSeries,
    });
  };
  onPathsUpdateError = () => {
    this.setState({
      fetchingError: true,
    });
  };

  // We need to do this weird dance around mousemove events because of performance
  // issues. RePinchy handles all of mouse events (because it needs them for its
  // own purposes too). If it doesn't need them, they are passed below to the
  // child(/ren) components. But if we would pass the mousemove values through props, we
  // would cause React rerendeings. Even with shouldComponentUpdate this is too
  // intensive.
  // So our solution is for the child component to register its mousemove handler
  // via call to `GLeanChartWidget.registerRepinchyMouseMoveHandler()`. On the other
  // hand, RePinchy gets our handler as its prop (and calls it), and we pass the
  // events to registered event handler. Easy, right? :)
  registerRePinchyMouseMoveHandler = handler => {
    this.repinchyMouseMoveHandler = handler;
  };
  handleRePinchyMouseMove = ev => {
    if (this.repinchyMouseMoveHandler === null) {
      return;
    }
    this.repinchyMouseMoveHandler(ev);
  };
  // and then we use the same principle with click, just to be consistent:
  registerRePinchyClickHandler = handler => {
    this.repinchyClickHandler = handler;
  };
  handleRePinchyClick = ev => {
    if (this.repinchyClickHandler === null) {
      return;
    }
    this.repinchyClickHandler(ev);
  };

  handleDrawnChartSeriesChange = drawnChartSeries => {
    this.setState({
      drawnChartSeries: drawnChartSeries,
    });
  };

  render() {
    const MAX_YAXIS_WIDTH = 70;
    const {
      width,
      height,
      setSharedValue,
      content: { chart_type, series_groups: seriesGroups },
    } = this.props;
    const accountId = this.props.match.params.accountId;
    let legendWidth, chartWidth, legendIsDockable, legendPositionStyle;
    if (width > 500) {
      legendWidth = Math.min(width * 0.3, 200);
      chartWidth = width - legendWidth;
      legendIsDockable = false;
      legendPositionStyle = {
        float: 'right',
      };
    } else {
      legendWidth = Math.min(width, 200);
      chartWidth = width;
      legendIsDockable = true;
      // if legend is dockable, it should be taken out of flow:
      legendPositionStyle = {
        position: 'absolute',
        right: 0,
        top: 0,
      };
    }
    const yAxisWidth = Math.min(Math.round(chartWidth * 0.1), MAX_YAXIS_WIDTH); // 10% of chart width, max. 100px
    const xAxisHeight = Math.min(Math.round(height * 0.1), 50); // 10% of chart height, max. 50px
    const yAxesCount = new Set(this.state.drawnChartSeries.map(cs => cs.unit)).size;
    const yAxesWidth = yAxesCount * yAxisWidth;

    const toTs = moment().add(1, 'minute').unix();
    const fromTs = moment().subtract(30, 'minute').unix();
    const initialScale = chartWidth / (toTs - fromTs);
    const initialPanX = -fromTs * initialScale;
    const timeIntervalSelectorHeight = 30;
    return (
      <div
        className="widget-dialog-container"
        style={{
          position: 'relative',
          minHeight: height,
          width: width,
        }}
      >
        <PersistentFetcher
          resource={`accounts/${accountId}/paths`}
          queryParams={{
            filter: seriesGroups.map(cc => cc.path_filter).join(','),
            limit: 1001,
            failover_trailing: 'false',
          }}
          onUpdate={this.onPathsUpdate}
          onError={this.onPathsUpdateError}
        />
        <RePinchy
          width={width}
          height={height}
          activeArea={{
            x: yAxesWidth,
            y: 0,
            w: chartWidth - yAxesWidth,
            h: height - timeIntervalSelectorHeight,
            zIndex: 2222,
          }}
          kidnapScroll={true}
          initialState={{
            x: initialPanX,
            y: 0.0,
            scale: initialScale,
          }}
          handleMouseMove={this.handleRePinchyMouseMove}
          handleClick={this.handleRePinchyClick}
        >
          {(x, y, scale, zoomInProgress, pointerPosition, setXYScale) => (
            <ZoomDebounce
              zoomInProgress={zoomInProgress}
              scale={scale}
              panX={x}
              activeArea={{
                x: yAxesWidth,
                y: 0,
                w: chartWidth - yAxesWidth,
                h: height - timeIntervalSelectorHeight,
              }}
            >
              {(debouncedX, debouncedScale) => (
                <div className="repinchy-content">
                  <ChartContainer
                    accountId={accountId}
                    allChartSeries={this.state.allChartSeries}
                    drawnChartSeries={this.state.drawnChartSeries}
                    width={chartWidth}
                    height={height - timeIntervalSelectorHeight}
                    fromTs={Math.round(-(debouncedX - yAxesWidth) / debouncedScale)}
                    toTs={
                      Math.round(-(debouncedX - yAxesWidth) / debouncedScale) +
                      Math.round(chartWidth / debouncedScale)
                    }
                    scale={debouncedScale}
                    zoomInProgress={zoomInProgress}
                    xAxisHeight={xAxisHeight}
                    yAxisWidth={yAxisWidth}
                    registerMouseMoveHandler={this.registerRePinchyMouseMoveHandler}
                    registerClickHandler={this.registerRePinchyClickHandler}
                    setSharedValue={setSharedValue}
                    chartType={chart_type}
                  />

                  <div style={legendPositionStyle}>
                    <Legend
                      dockingEnabled={legendIsDockable}
                      width={legendWidth}
                      height={height - timeIntervalSelectorHeight}
                      chartSeries={this.state.allChartSeries}
                      onDrawnChartSeriesChange={this.handleDrawnChartSeriesChange}
                    />
                  </div>
                  <TimeIntervalSelector
                    onChange={intervalDuration => {
                      const toTs = moment().unix();
                      const fromTs = moment().subtract(intervalDuration).unix();
                      const newScale = chartWidth / (toTs - fromTs);
                      const panX = -fromTs * newScale;
                      setXYScale(panX, 0, newScale);
                    }}
                  />
                </div>
              )}
            </ZoomDebounce>
          )}
        </RePinchy>
      </div>
    );
  }
}

const GLeanChartWidget = withRouter(isWidget(CoreGLeanChartWidget));

// there is no need for GLeanChartWidget to concern itself with sharedValues, we take care of substituting them here:
export default class ChartWidgetWithSubstitutedSharedValues extends React.Component {
  render() {
    const { sharedValues, content, ...rest } = this.props;
    const seriesGroupsSubstituted = (content.series_groups || []).map(sg => ({
      ...sg,
      path_filter: MatchingPaths.substituteSharedValues(sg.path_filter, sharedValues),
      renaming: MatchingPaths.substituteSharedValues(sg.renaming, sharedValues),
    }));
    const contentSubstituted = {
      ...content,
      series_groups: seriesGroupsSubstituted,
    };

    // We want to rerender GLeanChartWidget whenever one of the (applicable) sharedValues changes. The
    // safest way to achieve this is to construct a key from the path_filter-s:
    const pathFiltersForKey = seriesGroupsSubstituted.map(sg => sg.path_filter).join('#');

    const areSharedValuesSubstituted = !pathFiltersForKey.includes('$');
    if (!areSharedValuesSubstituted) {
      return <div>...waiting for navigation...</div>;
    }

    return <GLeanChartWidget key={pathFiltersForKey} {...rest} content={contentSubstituted} />;
  }
}
