import React from 'react';
import styled from 'styled-components';

import { generateSerieColor } from './utils';

const LegendRect = styled.div`
  width: 10px;
  height: 10px;
  border: 1px solid #999999;
  border-radius: 2px;
  margin: 5px;
`
LegendRect.displayName = 'LegendRect'

const LegendLabel = styled.span`
  font-family: "Comic Sans MS", cursive, sans-serif;
  font-size: 10px;
  text-anchor: end;
  fill: #333333;
  stroke: none;
  overflow-wrap: break-word;
`
LegendLabel.displayName = 'LegendLabel'

export default class Legend extends React.Component {

  render() {
    return (
      <div>
        {this.props.paths.map(path => (
          <div style={{
            position: 'relative',
          }}>
            <div style={{
                position: 'absolute',
                left: 10,
                top: 2,
              }}
            >
              <LegendRect style={{
                  backgroundColor: generateSerieColor(path),
                }}
              />
            </div>
            <div style={{
                paddingLeft: 35,
                marginBottom: 5,
              }}
            >
              <LegendLabel>{path}</LegendLabel>
            </div>
          </div>
        ))}
      </div>
    );
  }
}

