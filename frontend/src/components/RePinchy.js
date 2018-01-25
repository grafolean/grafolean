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
    scaleFactor: 1.1,
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
      zoomStartState: null,  // if zooming is in progress (for example when pinching) this contains start x, y and scale
      twinTouch: null,
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
    this.handleWheel = this.handleWheel.bind(this);
    this.clearOverlay = this.clearOverlay.bind(this);
  }

  // https://reactjs.org/docs/events.html
  handleTouchStart(event) {
    if (event.touches.length == 1) {
      event.preventDefault();  // !!! disable in production
      //this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length == 2) {
      event.preventDefault();
      //this.clearOverlay();
      this.handleTwinTouchStart(event);
    }
  }

  handleTouchMove(event) {
    if (event.touches.length == 1) {
      event.preventDefault();  // !!! disable in production
      //this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length == 2) {
      event.preventDefault();
      //this.clearOverlay();
      this.handleTwinTouchMove(event);
    }
  }

  handleTouchEnd(event) {
    event.preventDefault();
    if (event.touches.length == 1) {
      event.preventDefault();  // !!! disable in production
      //this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length == 2) {
      event.preventDefault();
      //this.clearOverlay();
      this.handleTwinTouchEnd(event);
    }
  }

  getTwinTouchDims(touches, element) {
    const rect = element.getBoundingClientRect();
    const dist = Math.sqrt(Math.pow(touches[0].clientX - touches[1].clientX, 2) + Math.pow(touches[0].clientY - touches[1].clientY, 2));
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
      dist,
    };
  };

  handleTwinTouchStart(event) {
    this.log("Twin touch start");
    event.persist();
    const startTwinTouch = this.getTwinTouchDims(event.touches, event.currentTarget);
    this.setState((oldState) => {
      return {
        twinTouch: {
          ...startTwinTouch,
        },
        zoomStartState: {  // remember old state so you can apply transformations from it; should be much more accurate
          x: oldState.x,
          y: oldState.y,
          scale: oldState.scale,
        }
      }
    })
  }

  handleTwinTouchMove(event) {

    /*
      In general, we have 2 actions user can perform with multitouch / twin touch:
      - zoom in/out (pinch)
      - pan (can be modified to only allow x or y but not both)
    */

    this.log("Twin touch move");
    event.persist();
    const newTwinTouch = this.getTwinTouchDims(event.touches, event.currentTarget);



    this.setState((oldState) => {
      if (oldState.twinTouch === null)
        return oldState;
      const scaleFactor = newTwinTouch.dist / oldState.twinTouch.dist;
      const dx = newTwinTouch.x - oldState.twinTouch.x;
      const dy = newTwinTouch.y - oldState.twinTouch.y;
      //const newScale = oldState.zoomStartState.scale * scaleFactor;
      const newX = oldState.zoomStartState.x + dx
      const newY = oldState.zoomStartState.y + dy
//      return this._applyZoomFunc(newX, newY, scaleFactor)(oldState);
      let scaleOldStateFunc = this._applyZoomFunc(newTwinTouch.x, oldState.y + newTwinTouch.y, scaleFactor);
      let ret = scaleOldStateFunc(oldState);
      ret.x += newX;
      ret.y += newY;
      // let ret = {
      //   scale: oldState.zoomStartState.scale * scaleFactor,
      //   x: newX,
      //   y: newY,
      // }
      return ret;
    })
  }

  handleTwinTouchEnd(event) {
    this.log("Twin touch end");
    this.setState({twinTouch: null})
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
    const event_offsetX = event.pageX - currentTargetRect.left,
          event_offsetY = event.pageY - currentTargetRect.top;

    if (event.deltaY < 0) {
      this._applyZoom(event_offsetX, event_offsetY, this.props.scaleFactor);
    }
    else if (event.deltaY > 0) {
      this._applyZoom(event_offsetX, event_offsetY, 1.0 / this.props.scaleFactor);
    }
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
            <div
              style={{
                  width: this.props.width,
                  height: this.props.height,
                  marginLeft: this.state.x,
                  marginTop: this.state.y,
                  transformOrigin: "top left",
                  transform: `scale(${this.state.scale})`,
              }}>
              <img src="/static/nature.jpeg" />
            </div>
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