import React from 'react';

export default class RePinchy extends React.Component {

  /*
    Single touch:
      Scrolling the page should not be affected, so anything which is not a tap should be ignored. We do not use taps however,
      so - single touches should be ignored as far as handling is concerned. However component should detect them and display
      an overlay with helpful message ("Use 2 fingers to move and zoom").
    Twin fingers:
      Multitouch with >2 fingers is ignored. Multitouch with 2 fingers allows user to set pan and zoom.
    Wheel:
      Scrolling the page should not be affected, so wheel is ignored unless Ctrl is pressed. If detected, helpful overlay
      should be displayed ("Use Ctrl + mousewheel to zoom").
    Mouse click, double click:
      Should be let through to the underlying components. Optionally, double click can be used to zoom in (or is that up to
        underlying component to call zoom in function?)
    Mouse down/move/up:
      Should be used to pan.
  */

  static defaultProps = {
    width: 200,  // RePinchy's viewport width & height
    height: 300,
    padLeft: 0,  // how much the zoomable inner component is padded on left
    initialScale: 1.0,
    wheelScaleFactor: 1.1,  // how fast wheel zooms in/out
    renderSub: (x, y, scale) => {
      return <p>Please specify renderSub prop!</p>
    }
  };

  constructor() {
    super(...arguments);

    this.state = {
      x: this.props.initialState.x || 0,
      y: this.props.initialState.y || 0,
      scale: this.props.initialState.scale || 1.0,
      zoomInProgress: false,

      zoomStartState: null,  // if zooming/panning is in progress (for example when pinching) this contains start x, y and scale
      twinTouch: null,  // internal data about progress of twin finger touch
      mousePan: null,  // internal data abour progress of mounse pan operation (drag to pan)
      overlay: {
        shown: false,
        msg: "",
      },
      debugMessages: [  // easier debugging of (touch) events on mobile devices
        {id: 0, msg: "Init"},
      ],
    }

    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClickCapture = this.handleClickCapture.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleCtrlKeyUp = this.handleCtrlKeyUp.bind(this);
    this.clearOverlay = this.clearOverlay.bind(this);
    this.onTestButtonClick = this.onTestButtonClick.bind(this);
  }

  componentDidMount(){
    document.addEventListener("keyup", this.handleCtrlKeyUp, false);
  }
  componentWillUnmount(){
    document.removeEventListener("keyup", this.handleCtrlKeyUp, false);
  }

  // https://reactjs.org/docs/events.html
  handleTouchStart(event) {
    if (event.touches.length === 1) {
      event.preventDefault();  // !!! disable in production
      //this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length === 2) {
      event.preventDefault();
      //this.clearOverlay();
      //let {x, y, dist} = this._getTwinTouchDims(event);
      this.handleTwinTouchStart(event);
    }
  }

  handleTouchMove(event) {
    if (event.touches.length === 1) {
      event.preventDefault();  // !!! disable in production
      //this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length === 2) {
      event.preventDefault();
      //this.clearOverlay();
      this.handleTwinTouchMove(event);
    }
  }

  handleTouchEnd(event) {
    // when touch ends, it ends - it doesn't matter with how many fingers:
    this.handleTwinTouchEnd(event);
  }

  _getTwinTouchDims(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const dist = Math.sqrt(Math.pow(event.touches[0].clientX - event.touches[1].clientX, 2) + Math.pow(event.touches[0].clientY - event.touches[1].clientY, 2));
    let x = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left - this.props.padLeft;
    let y = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
    this.log("Touch:", x, y, dist);
    return {
      x,
      y,
      dist,
    };
  };

  handleTwinTouchStart(event) {
    this.log("Twin touch start");
    event.persist();
    const startTwinTouch = this._getTwinTouchDims(event);
    this.setState((oldState) => {
      return {
        twinTouch: {
          ...startTwinTouch,
        },
        zoomStartState: {  // remember old state so you can apply transformations from it; should be much more accurate
          x: oldState.x,
          y: oldState.y,
          scale: oldState.scale,
        },
        zoomInProgress: true,
      }
    })
  }

  handleTwinTouchMove(event) {

    /*
      In general, we have 2 actions user can perform with multitouch / twin touch:
      - zoom in/out (pinch)
      - pan (can be modified to only allow x or y but not both)
    */

    //this.log("Twin touch move");
    event.persist();
    const newTwinTouch = this._getTwinTouchDims(event);
    this.setState((oldState) => {
      if ((oldState.twinTouch === null) || (!oldState.zoomInProgress))
        return oldState;
      let scaleFactor = newTwinTouch.dist / oldState.twinTouch.dist;
      return {
        x: newTwinTouch.x - (oldState.twinTouch.x - oldState.zoomStartState.x) * scaleFactor,
        y: newTwinTouch.y - (oldState.twinTouch.y - oldState.zoomStartState.y) * scaleFactor,
        scale: oldState.zoomStartState.scale * scaleFactor,
      };
    })
  }

  handleTwinTouchEnd(event) {
    this.log("Twin touch end");
    this.setState({
      twinTouch: null,
      zoomStartState: null,
      zoomInProgress: false,
    })
    event.preventDefault();
  }

  _applyZoom(zoomOffsetX, zoomOffsetY, scaleFactor) {
    this.setState(this._applyZoomFunc(zoomOffsetX, zoomOffsetY, scaleFactor))
  }

  _applyZoomFunc(zoomOffsetX, zoomOffsetY, scaleFactor) {
    // returns the function which can be used to setState
    return (oldState) => {
      let startState = (oldState.zoomStartState === null) ? (oldState) : (oldState.zoomStartState);
      return {
        scale: startState.scale * scaleFactor,
        x: zoomOffsetX - (zoomOffsetX - startState.x) * scaleFactor,
        y: zoomOffsetY - (zoomOffsetY - startState.y) * scaleFactor,
      }
    }
  }

  handleWheel(event) {
    if (!event.ctrlKey) {
      this.log("Wheel", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
      this.ensureOverlayShown("Use CTRL + mouse wheel to zoom");
      return;
    }

    let currentTargetRect = event.currentTarget.getBoundingClientRect();

    this.log("Wheel CTRL!", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
    const event_offsetX = event.pageX - currentTargetRect.left - this.props.padLeft,
          event_offsetY = event.pageY - currentTargetRect.top;

    this.setState({zoomInProgress: true})

    if (event.deltaY < 0) {
      this._applyZoom(event_offsetX, event_offsetY, this.props.wheelScaleFactor);
    }
    else if (event.deltaY > 0) {
      this._applyZoom(event_offsetX, event_offsetY, 1.0 / this.props.wheelScaleFactor);
    }
    event.preventDefault();
  }

  handleMouseDown(event) {
    console.log("mouse down")
    // we need to listen for mouseup anywhere, not just over our component, so we need to
    // register event listener:
    window.addEventListener('mouseup', this.handleMouseUp, false);
    window.addEventListener('mousemove', this.handleMouseMove, false);

    const event_clientX = event.clientX,
          event_clientY = event.clientY;
    this.setState((oldState) => {
      return {
        mousePan: {
          startClientX: event_clientX,
          startClientY: event_clientY,
        },
        zoomStartState: {  // remember old state so you can apply transformations from it; should be much more accurate
          x: oldState.x,
          y: oldState.y,
          scale: oldState.scale,
        }
      };
    })
    event.preventDefault();
  }

  handleMouseMove(event) {
    //console.log("mouse move");
    if (!this.state.mousePan)
      return;
    const event_clientX = event.clientX,
          event_clientY = event.clientY;
    this.setState((oldState) => {
      return {
        x: oldState.zoomStartState.x + (event_clientX - oldState.mousePan.startClientX),
        y: oldState.zoomStartState.y + (event_clientY - oldState.mousePan.startClientY),
      };
    });
  }

  handleMouseUp(event) {
    console.log("mouse up");
    // event listener did its work, now unregister it:
    window.removeEventListener('mouseup', this.handleMouseUp, false);
    window.removeEventListener('mousemove', this.handleMouseMove, false);
    this.setState({
      mousePan: null,
      zoomStartState: null,
    });
    event.preventDefault();
  }

  handleCtrlKeyUp(event) {
    if (event.keyCode === 17) {
      this.setState({
        zoomInProgress: false,
      })
    }
  }

  handleClickCapture(event) {
    // we don't intercept click event - except that it tells us that mouseDown & mouseUp should not be used for dragging
    console.log("mouse click");
    //event.stopPropagation();
  }

  onTestButtonClick(event) {
    console.log("Yeah!");
    event.preventDefault();
  }

  log(...msgs) {
    let msg = msgs.join(" ");
    this.setState((oldState) => {
      return {
        debugMessages: [
          {id: oldState.debugMessages[0].id + 1, msg: msg},
          ...oldState.debugMessages.slice(0, 15),
        ]
      }
    })
  }

  ensureOverlayShown(msg) {
    let clearOverlayTimeoutHandle = setTimeout(this.clearOverlay, 2000);
    if (this.state.overlay.timeoutHandle) {
      clearTimeout(this.state.overlay.timeoutHandle);
    }

    this.setState((oldState) => {
      return {
        overlay: {
          shown: true,
          msg: msg,
          timeoutHandle: clearOverlayTimeoutHandle,
        }
      }
    });
  }

  clearOverlay() {
    this.setState((oldState) => {
      return { overlay: { shown: false } }
    });
  }

  render() {
    return (
      <div style={{
        position: 'relative',
        width: this.props.width,
        height: this.props.height,
      }}>
        <div
          onTouchStart={this.handleTouchStart}
          onTouchMove={this.handleTouchMove}
          onTouchEnd={this.handleTouchEnd}
          onWheel={this.handleWheel}
          onMouseDown={this.handleMouseDown}
          onKeyDown={this.handleKeyDown}
          onKeyUp={this.handleKeyUp}
          onClickCapture={this.handleClickCapture}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: this.props.width,
            height: this.props.height,
            overflow: 'hidden',
            border: '1px solid #eeeeee',
          }}
          >
          {this.props.renderSub(this.props.width, this.props.height, this.state.x, this.state.y, this.state.scale, this.state.zoomInProgress)}
        </div>
        {(this.state.overlay.shown)?(
          [
            <div key='overlay-bg' style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: this.props.width,
              height: this.props.height,
              backgroundColor: '#000000',
              opacity: 0.2,
              pointerEvents: 'none',  // do not catch mouse and touch events
              touchAction: 'none',
            }}></div>,
            <div key='overlay-text' style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: this.props.width,
              height: this.props.height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 20,
              pointerEvents: 'none',  // do not catch mouse and touch events
              touchAction: 'none',
            }}>
              <span style={{textAlign: 'center'}}>
                {this.state.overlay.msg}
              </span>
            </div>
          ]
        ):(null)}
      </div>
    );
  }
}