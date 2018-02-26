import React, { Component } from 'react';
import Loading from '../Loading'

import MoonChart from '../MoonChart';
import RePinchy from '../RePinchy';

class Chart extends Component {

  render() {
    if (this.props.loading) {
      return (
        <Loading />
      )
    };

    return (
      <RePinchy
        width={600}
        height={300}
        padLeft={60}
        initialState={{
          x: -1234567820.0,
          y: 0.0,
          scale: 1.0,
        }}>
        {(w, h, x, y, scale, zoomInProgress) => (
          <MoonChart
            portWidth={w}
            portHeight={h}
            panX={-x}
            scale={scale}
            zoomInProgress={zoomInProgress}
            minTimestamp={1234567820.0}
            maxTimestamp={1234569220.0}
            minY={0}
            maxY={250}
            data={{
              'asdf.123.qwer': [
                { t: 1234567890.000000, v: 193.400000 },
                { t: 1234567960.000000, v: 189.900000 },
                { t: 1234568030.000000, v: 137.200000 },
                { t: 1234568100.000000, v: 157.200000 },
                { t: 1234568170.000000, v: 174.000000 },
                { t: 1234568240.000000, v: 152.700000 },
                { t: 1234568310.000000, v: 170.400000 },
                { t: 1234568380.000000, v: 154.200000 },
                { t: 1234568450.000000, v: 138.700000 },
                { t: 1234568520.000000, v: 190.200000 },
                { t: 1234568590.000000, v: 142.600000 },
                { t: 1234568660.000000, v: 106.300000 },
                { t: 1234568730.000000, v: 130.400000 },
                { t: 1234568800.000000, v: 161.200000 },
                { t: 1234568870.000000, v: 199.600000 },
                { t: 1234568940.000000, v: 138.000000 },
                { t: 1234569010.000000, v: 159.100000 },
                { t: 1234569080.000000, v: 189.400000 },
                { t: 1234569150.000000, v: 101.600000 },
                { t: 1234569220.000000, v: 189.500000 },
              ],
              'asdf.123.qwer2': [
                { t: 1234567820.000000, v: 168.100000 },
                { t: 1234567965.000000, v: 191.700000 },
                { t: 1234568110.000000, v: 152.300000 },
                { t: 1234568255.000000, v: 193.200000 },
                { t: 1234568400.000000, v: 227.500000 },
                { t: 1234568545.000000, v: 179.000000 },
                { t: 1234568690.000000, v: 228.700000 },
                { t: 1234568835.000000, v: 169.500000 },
                { t: 1234568980.000000, v: 229.300000 },
                { t: 1234569125.000000, v: 159.600000 },
              ],
            }}
          />
        )}
      </RePinchy>
    )
  }
}

export default Chart;


//           <Chart
//             domain={this.props.domain}
//             theme={VictoryTheme.material}
//             allowZoom={false}
//             containerComponent={
//               <VictoryZoomContainer
//                 allowZoom={false}
//               />
//             }
//           >
//             <VictoryAxis
//               {...this._domainXTickProps(this.props.domain.x[0], this.props.domain.x[1])}
//             />
//             <VictoryAxis
//               dependentAxis
//               tickFormat={(tick) => `$${Math.round(tick)}M`}
//             />
//             <VictoryAxis
//               dependentAxis
//               orientation="right"
//               tickFormat={(tick) => `$${Math.round(tick)}M`}
//             />
//             <VictoryAxis
//               dependentAxis
//               orientation="left"
//               offsetX={+20}
//               tickFormat={(tick) => `${Math.round(tick)} EUR`}
//             />

//             {(this.props.isAggregated)?(
//               // aggregated charts have the min/max shadow behind the lines:
//               Object.keys(this.props.series).filter(path => {
//                 return this.props.series[path].visible;
//               }).map((path) => {
//                 return (
//                   <VictoryArea
//                     key={`area-${path}`}
//                     data={this.props.series[path].data}
//                     x="t" y="ymin" y0="ymax"
//                     style={{
//                       data: {
//                         fill: this.props.series[path].color, fillOpacity: 0.2, strokeWidth: 0
//                       },
//                     }}
//                   />
//                 )
//               })
//             ):(null)}

//             {Object.keys(this.props.series).filter(path => {
//               return this.props.series[path].visible;
//             }).map((path) => {
//               return (
//                 <VictoryLine
//                   key={`line-${path}`}
//                   data={this.props.series[path].data}
//                   x="t" y="y"
//                   style={{
//                     data: { stroke: this.props.series[path].color, strokeWidth: 1 },
// //                    parent: { border: "1px solid #ccc"},
//                   }}
//                 />
//               )
//             })}
//         </VictoryChart>

