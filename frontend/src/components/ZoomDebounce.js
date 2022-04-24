import React from 'react';

import Overlay from './Overlay';

export default class ZoomDebounce extends React.PureComponent {
  static defaultProps = {
    zoomInProgress: false,
    scale: null,
    panX: null,
  };
  state = {
    passDownScale: this.props.scale,
    passDownPanX: this.props.panX,
  };

  componentDidUpdate(prevProps) {
    if (prevProps.scale !== this.props.scale || prevProps.zoomInProgress !== this.props.zoomInProgress) {
      if (!this.props.zoomInProgress) {
        this.setState({ passDownScale: this.props.scale });
      }
    }
    if (prevProps.panX !== this.props.panX || prevProps.zoomInProgress !== this.props.zoomInProgress) {
      if (!this.props.zoomInProgress) {
        this.setState({ passDownPanX: this.props.panX });
      }
    }
  }

  render() {
    const { zoomInProgress, activeArea, scale } = this.props;
    const { passDownScale, passDownPanX } = this.state;
    return (
      <>
        {this.props.children(passDownPanX, passDownScale)}
        {zoomInProgress && (
          <Overlay
            left={activeArea.x}
            top={activeArea.y}
            width={activeArea.w}
            height={activeArea.h}
            msg={`Zoom: ${scale}`}
          />
        )}
      </>
    );
  }
}
