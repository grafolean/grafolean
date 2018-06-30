import React from 'react';

import './isDockable.css';

const isDockable = WrappedComponent => {
  return class Dockable extends React.Component {
    static defaultProps = {
      dockingEnabled: false,  // if false, do not do anything (don't even display a button) - docking is not allowed
      initiallyOpened: false,
    }

    PADDING = 10;
    SHADOW_SIZE = 10;

    constructor(props) {
      super(props);
      this.state = {
        opened: props.initiallyOpened,
      };
    }

    toggleOpened = () => {
      this.setState(oldState => ({
        opened: !oldState.opened,
      }));
    }

    render() {
      const { width, height, ...passThroughProps } = this.props;
      let wrapperStyle;
      if (this.props.dockingEnabled) {
        wrapperStyle = {
          position: 'absolute',
          right: this.state.opened ? -1 : -(width + 2 + this.SHADOW_SIZE),
          top: 28,
          transition: 'right ease-in 0.1s',
          overflowX: 'hidden',
          backgroundColor: '#fff',
          border: '1px solid #999999',
          zIndex: 2,
          padding: this.PADDING,
          boxShadow: `0 0 ${this.SHADOW_SIZE}px #999999`,
        };
      } else {
        wrapperStyle = {}
      }
      return (
        <div
          style={{
            position: 'relative',
          }}
        >
          <div
            className="dockable-container"
            style={{
              // if docking is enabled, we can take more than width: (and we need space for border and shadow)
              width: this.props.dockingEnabled ? width + 2 + this.SHADOW_SIZE : width,
              height: this.props.dockingEnabled ? height + 2 : height,
            }}
          >
            <div
              style={wrapperStyle}
            >
              <WrappedComponent
                width={width - 2*this.PADDING}
                height={height - 32 - 2*this.PADDING - this.SHADOW_SIZE}
                {...passThroughProps}
              />
            </div>
          </div>
          {this.props.dockingEnabled && (
            <a
              className="toggle-collapse-button"
              onClick={this.toggleOpened}
            >
              <i
                className="fa fa-chevron-left"
                style={{
                  transform: `rotate(${this.state.opened ? 180 : 0}deg)`,
                  transition: 'transform ease-in 0.1s',
                  marginRight: this.state.opened ? -1 : 4,
            }}
          />
            </a>
          )}
        </div>
      )
    }
  }
}

export default isDockable;