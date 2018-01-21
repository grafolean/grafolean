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
    renderSub: (x, y, scale) => {
      return <p>Please specify renderSub prop!</p>
    }
  };

  constructor() {
    super(...arguments);

    this.state = {
      x: 0,
      y: 0,
      scale: 1,
      debugMessages: [  // easier debugging of (touch) events on mobile devices
        {id: 0, msg: "Init"},
      ],
      overlay: {
        shown: false,
        msg: "",
      }
    }

    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.clearOverlay = this.clearOverlay.bind(this);
  }

  // https://reactjs.org/docs/events.html
  handleTouchStart(event) {
    if (event.touches.length == 1) this.handleSingleTouchStart(event);
    else if (event.touches.length == 2) this.handleTwinTouchStart(event);
  }

  handleTouchMove(event) {
    if (event.touches.length == 1) this.handleSingleTouchMove(event);
    else if (event.touches.length == 2) this.handleTwinTouchMove(event);
  }

  handleTouchEnd(event) {
    if (event.touches.length == 1) this.handleSingleTouchEnd(event);
    else if (event.touches.length == 2) this.handleTwinTouchEnd(event);
  }

  handleSingleTouchStart(event) {
    this.log("Single touch start", event.touches[0].clientX, event.touches[0].clientY);
    this.ensureOverlayShown("Use 2 fingers to zoom and pan");
  }
  handleSingleTouchMove(event) {
    this.log("Single touch move", event.touches);
    this.ensureOverlayShown("Use 2 fingers to zoom and pan");
  }
  handleSingleTouchEnd(event) {
    this.log("Single touch end", event.touches);
    this.ensureOverlayShown("Use 2 fingers to zoom and pan");
  }

  handleTwinTouchStart(event) {
    this.log("Twin touch start", event.touches);
    this.setState({lastTouches: [...event.touches]})
    event.preventDefault();
  }
  handleTwinTouchMove(event) {
    this.log("Twin touch move", event.touches);
    this.setState({lastTouches: [...event.touches]})
    event.preventDefault();
  }
  handleTwinTouchEnd(event) {
    this.log("Twin touch end", event.touches);
    this.setState({lastTouches: [...event.touches]})
    event.preventDefault();
  }
  handleWheel(event) {
    if (!event.ctrlKey) {
      this.log("Wheel", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
      this.ensureOverlayShown("Use CTRL + mouse wheel to zoom");
      return;
    }

    this.log("Wheel CTRL!", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
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
    return ([
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
            <img
              src={`http://lorempixel.com/600/400/nature/`}
              />
          {/*this.props.renderSub(this.state.x, this.state.y, this.state.scale)*/}
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
      </div>,
      <div style={{width: 200, height: 700}}>
        {this.state.debugMessages.map((item) =>
          <p key={item.id}>{item.id}. {item.msg}</p>
        )}
      </div>]
  );
  }
}