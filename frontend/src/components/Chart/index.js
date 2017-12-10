import React, { Component } from 'react';
import { LineChart, Line, AreaChart, Area } from 'recharts';

const data = [
  {name: 'Page A', uv: 4000, pv: 2430, amt: [2400,2500]},
  {name: 'Page B', uv: 3000, pv: 2398, amt: [2210,2600]},
  {name: 'Page C', uv: 2000, pv: 2340, amt: [2290,2550]},
  {name: 'Page D', uv: 2780, pv: 2108, amt: [2000,2200]},
  {name: 'Page E', uv: 1890, pv: 2200, amt: [2181,2300]},
  {name: 'Page F', uv: 2390, pv: 2600, amt: [2500,2700]},
  {name: 'Page G', uv: 3490, pv: 2120, amt: [2100,2150]},
];

class Chart extends Component {
  render() {
    return (
      <AreaChart width={400} height={400} data={data}>
        <Area type="linear" dataKey="pv" stroke="#ff6600" fillOpacity={0} fill="#ff6600" />
        <Area type="linear" dataKey="amt" stroke={false} fillOpacity={0.1} fill="#ff6600" />
      </AreaChart>
    );
  }
}

export default Chart;
