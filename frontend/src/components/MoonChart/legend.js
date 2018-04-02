import React from 'react';

import './legend.css';

import { generateSerieColor } from './utils';

export default class Legend extends React.Component {
  static defaultProps = {
    onDrawnPathsChange: (selectedPaths) => {},
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedPaths: new Set(this.props.paths),
      filter: "",
    }
  }

  componentDidMount() {
    this.onPathFilterChange = this.onPathFilterChange.bind(this);
    this.setStateCallbackOnDrawnPathsChange = this.setStateCallbackOnDrawnPathsChange.bind(this);
  }

  setStateCallbackOnDrawnPathsChange() {
    const drawnPaths = [ ...this.state.selectedPaths ].filter((path) => (this.state.filter === "" || path.includes(this.state.filter)));
    this.props.onDrawnPathsChange(drawnPaths);
  }

  onPathFilterChange(ev) {
    this.setState(
      {
        filter: ev.target.value,
      },
      this.setStateCallbackOnDrawnPathsChange
    );
  }

  togglePathSelected(path) {
    this.setState(
      oldState => {
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
      this.setStateCallbackOnDrawnPathsChange
    );
  }

  render() {
    const filteredPaths = this.props.paths.filter(path => (this.state.filter === "" || path.includes(this.state.filter)));
    return (
      <div>
        <div className="path-filter">
          <input
            type="text"
            name="pathFilter"
            onChange={ev => this.onPathFilterChange(ev)}
          />
          <i className="fa fa-filter" />
        </div>

        {(filteredPaths.length === 0) ? (
          <div className="path-filter-noresults">
            No paths match the filter "{this.state.filter}"
          </div>
        ) : (
          filteredPaths.map(path => (
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
                <span className="legend-label">{path}</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
}

