import React from 'react';
import styled from 'styled-components';

import './legend.css';

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
  static defaultProps = {
    onSelectedPathsChange: selectedPaths => {},
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedPaths: new Set(this.props.paths),
    }
  }

  togglePathSelected(path) {
    this.setState(oldState => {
      const newSelectedPaths = new Set(oldState.selectedPaths);
      if (newSelectedPaths.has(path)) {
        newSelectedPaths.delete(path);
      } else {
        newSelectedPaths.add(path);
      }
      return {
        selectedPaths: newSelectedPaths,
      }
    },
    () => {
      this.props.onSelectedPathsChange(this.state.selectedPaths);
    });
  }

  render() {
    return (
      <div>
        <div className="path-filter">
          <input
            type="text"
            name="pathFilter"
          />
          <i className="fa fa-filter" />
        </div>

        {this.props.paths.map(path => (
          <div
            key={path}
            style={{
              position: 'relative',
            }}
            onClick={() => this.togglePathSelected(path)}
          >
            <div className="path-checkbox"
              style={{
                borderColor: generateSerieColor(path),
              }}
            >
              <div
                style={{
                  backgroundColor: (this.state.selectedPaths.has(path)) ? (generateSerieColor(path)) : ('#fff'),
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

