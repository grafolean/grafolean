import React from 'react';
import { storiesOf } from '@storybook/react';
import { Provider } from 'react-redux';

import store from '../src/store';
import { CoreGLeanChartWidget } from '../src/components/Widgets/GLeanChartWidget/GLeanChartWidget';
import { setAccountEntities, setColorScheme } from '../src/store/actions';
import MockContext from './MockContext';

import '../src/components/Widgets/GLeanChartWidget/GLeanChartWidget.scss';
import '../src/index.scss';
import './index.scss';

const stories = storiesOf('Line chart - complete', module);

stories.add('Complete chart widget', () => {
  const PATH_FILTER = 'asdf.test.?.?';
  const PATHS = [
    'asdf.test.1.LAN',
    'asdf.test.1.sfp1',
    'asdf.test.10.ether9',
    'asdf.test.11.ether10',
    'asdf.test.12.wlan1',
  ];

  store.dispatch(setAccountEntities([]));
  store.dispatch(setColorScheme('dark'));

  function random(index) {
    var x = Math.sin(index) * 10000;
    return x - Math.floor(x);
  }

  function generateRandomData(fromTs, toTs, isAggr, step, seed) {
    let data = [];
    for (let t = fromTs; t <= toTs && t <= Date.now() / 1000; t += step) {
      const d = {
        t: t + random(t), // we wish for all the paths to have the same "randomized" times
        v: 5.0 * (3.0 + random(t + seed)) + 26 * random(seed), // while the values should differ
      };
      if (isAggr) {
        d.minv = d.v - 2.0;
        d.maxv = d.v + 2.0;
      }
      data.push(d);
    }
    return data;
  }

  const mockPersistentFetcherValue = {
    onMount: props => {
      const postBody = props.fetchOptions ? JSON.parse(props.fetchOptions.body) : null;
      switch (props.resource) {
        case 'accounts/123/paths':
          setTimeout(() => {
            props.onUpdate({
              paths: {
                [PATH_FILTER]: PATHS.map((p, i) => ({ id: i + 1, path: p })),
              },
              limit_reached: false,
            });
          }, 0);
          break;
        case 'accounts/123/getvalues':
          setTimeout(() => {
            const result = {};
            for (let i = 0; i < PATHS.length; i++) {
              result[PATHS[i]] = {
                next_data_point: null,
                data: generateRandomData(postBody.t0, postBody.t1, false, 10, i),
              };
            }
            props.onUpdate(
              {
                paths: result,
                limit_reached: false,
              },
              {
                fetchOptions: props.fetchOptions,
              },
            );
          }, 0);
          break;
        case 'accounts/123/getaggrvalues':
          setTimeout(() => {
            const result = {};
            for (let i = 0; i < PATHS.length; i++) {
              result[PATHS[i]] = {
                next_data_point: null,
                data: generateRandomData(postBody.t0, postBody.t1, true, 1000, i),
              };
            }
            props.onUpdate(
              {
                paths: result,
                limit_reached: false,
              },
              {
                fetchOptions: props.fetchOptions,
              },
            );
          }, 0);
          break;
        default:
          console.error(
            `MockPersistentFetcher: don't know how to mock resource fetching: ${props.resource}`,
            props,
          );
          console.log(props);
          props.onError(`Don't know how to mock resource fetching: ${props.resource}`);
          break;
      }
    },
    onUnmount: () => {},
  };

  return (
    <MockContext.Provider value={mockPersistentFetcherValue}>
      <Provider store={store}>
        <div className="dark-mode dark-bg">
          <CoreGLeanChartWidget
            match={{ params: { accountId: 123 } }} // simulate React Router
            content={{
              chart_type: 'line',
              series_groups: [
                {
                  path_filter: PATH_FILTER,
                  renaming: 'Test $2',
                  expression: '$1',
                  unit: 'kg',
                },
              ],
            }}
            width={1000}
            height={500}
            isFullscreen={false}
            isDarkMode={true}
          />
        </div>
      </Provider>
    </MockContext.Provider>
  );
});
