import React, { Component } from 'react';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import moment from 'moment';

const data = [
  {t: 1080001800, uv: 4000, pv: 2430, amt: [2400,2500]},
  {t: 1080005400, uv: 3000, pv: 1398, amt: [1210,1600]},
  {t: 1080009000, uv: 2000, pv: 2340, amt: [2290,2550]},
  {t: 1080012600, uv: 2780, pv: 2108, amt: [2000,2200]},
  {t: 1080016200, uv: 1890, pv: 2200, amt: [2181,2300]},
  {t: 1080019800, uv: 2390, pv: 2600, amt: [2500,2700]},
  {t: 1080023400, uv: 3490, pv: 2120, amt: [2100,2150]},
];

class Chart extends Component {
  render() {
    return (
      <div style={{height: '250px'}}>
      <ResponsiveContainer width='30%'>
        <AreaChart width={400} height={550} data={data}>
          <Area type="linear" dataKey="pv" stroke="#ff6600" fillOpacity={0} fill="#ff6600" />
          <Area type="linear" dataKey="amt" stroke="none" fillOpacity={0.1} fill="#ff6600" />
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[3600*300000, 3600*300007]}
            tickFormatter={(tick) => moment(tick * 1000).format('HH:mm')}
            ticks={[1080000000, 1080003600, 1080007200, 1080010800, 1080014400, 1080018000, 1080021600, 1080025200]}
          />
          <YAxis />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    );
  }
}

export default Chart;
