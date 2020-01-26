import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../../store/actions';
import { fetchAuth } from '../../../utils/fetch';

import RePinchy from '../../RePinchy';
import ChartContainer from './ChartContainer';
import Legend from './Legend/Legend';
import MatchingPaths from './ChartForm/MatchingPaths';
import isWidget from '../isWidget';
import TimeIntervalSelector from './TimeIntervalSelector';

import './GLeanChartWidget.scss';

class GLeanChartWidget extends React.Component {
  state = {
    loading: true,
    drawnChartSeries: [],
    allChartSeries: [],
  };
  repinchyMouseMoveHandler = null;
  repinchyClickHandler = null;
  fetchPathsAbortController = null;

  componentDidMount() {
    this.fetchPaths();
  }

  componentWillUnmount() {
    if (this.fetchPathsAbortController !== null) {
      this.fetchPathsAbortController.abort();
    }
  }

  fetchPaths = () => {
    if (this.fetchPathsAbortController !== null) {
      return; // fetch is already in progress
    }
    this.fetchPathsAbortController = new window.AbortController();
    const seriesGroups = this.props.content;
    const query_params = {
      filter: seriesGroups.map(cc => cc.path_filter).join(','),
      limit: 1001,
      failover_trailing: 'false',
    };
    const accountId = this.props.match.params.accountId;
    fetchAuth(`${ROOT_URL}/accounts/${accountId}/paths/?${stringify(query_params)}`, {
      signal: this.fetchPathsAbortController.signal,
    })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        // construct a better representation of the data for display in the chart:
        const allChartSeries = seriesGroups.reduce((result, c, seriesGroupIndex) => {
          return result.concat(
            json.paths[c.path_filter].map(p => ({
              chartSerieId: `${seriesGroupIndex}-${p.id}`,
              path: p.path,
              serieName: MatchingPaths.constructChartSerieName(p.path, c.path_filter, c.renaming),
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
      })
      .catch(errorMsg => {
        this.setState({
          fetchingError: true,
        });
      })
      .then(() => {
        this.fetchPathsAbortController = null;
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
    let legendWidth, chartWidth, legendIsDockable, legendPositionStyle;
    if (this.props.width > 500) {
      legendWidth = Math.min(this.props.width * 0.3, 200);
      chartWidth = this.props.width - legendWidth;
      legendIsDockable = false;
      legendPositionStyle = {
        float: 'right',
      };
    } else {
      legendWidth = Math.min(this.props.width, 200);
      chartWidth = this.props.width;
      legendIsDockable = true;
      // if legend is dockable, it should be taken out of flow:
      legendPositionStyle = {
        position: 'absolute',
        right: 0,
        top: 0,
      };
    }
    const yAxisWidth = Math.min(Math.round(chartWidth * 0.1), MAX_YAXIS_WIDTH); // 10% of chart width, max. 100px
    const xAxisHeight = Math.min(Math.round(this.props.height * 0.1), 50); // 10% of chart height, max. 50px
    const yAxesCount = new Set(this.state.drawnChartSeries.map(cs => cs.unit)).size;
    const yAxesWidth = yAxesCount * yAxisWidth;

    const toTs = moment()
      .add(1, 'minute')
      .unix();
    const fromTs = moment()
      .subtract(30, 'minute')
      .unix();
    const initialScale = chartWidth / (toTs - fromTs);
    const initialPanX = -fromTs * initialScale;
    return (
      <div
        className="widget-dialog-container"
        style={{
          position: 'relative',
          minHeight: this.props.height,
          width: this.props.width,
        }}
      >
        <RePinchy
          width={this.props.width}
          height={this.props.height}
          activeArea={{
            x: yAxesWidth,
            y: 0,
            w: chartWidth - yAxesWidth,
            h: this.props.height,
          }}
          kidnapScroll={this.props.isFullscreen}
          initialState={{
            x: initialPanX,
            y: 0.0,
            scale: initialScale,
          }}
          handleMouseMove={this.handleRePinchyMouseMove}
          handleClick={this.handleRePinchyClick}
        >
          {(x, y, scale, zoomInProgress, pointerPosition, setXYScale) => (
            <div className="repinchy-content">
              <ChartContainer
                allChartSeries={this.state.allChartSeries}
                drawnChartSeries={this.state.drawnChartSeries}
                width={chartWidth}
                height={this.props.height}
                fromTs={Math.round(-(x - yAxesWidth) / scale)}
                toTs={Math.round(-(x - yAxesWidth) / scale) + Math.round(chartWidth / scale)}
                scale={scale}
                zoomInProgress={zoomInProgress}
                xAxisHeight={xAxisHeight}
                yAxisWidth={yAxisWidth}
                registerMouseMoveHandler={this.registerRePinchyMouseMoveHandler}
                registerClickHandler={this.registerRePinchyClickHandler}
              />
              <div style={legendPositionStyle}>
                <Legend
                  dockingEnabled={legendIsDockable}
                  width={legendWidth}
                  height={this.props.height}
                  chartSeries={this.state.allChartSeries}
                  onDrawnChartSeriesChange={this.handleDrawnChartSeriesChange}
                />
              </div>
              <TimeIntervalSelector
                style={{ right: legendWidth }}
                onChange={intervalDuration => {
                  const toTs = moment().unix();
                  const fromTs = moment()
                    .subtract(intervalDuration)
                    .unix();
                  const scale = chartWidth / (toTs - fromTs);
                  const panX = -fromTs * scale;
                  setXYScale(panX, 0, scale);
                }}
              />
            </div>
          )}
        </RePinchy>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  accounts: store.accounts,
});
export default withRouter(connect(mapStoreToProps)(isWidget(GLeanChartWidget)));
