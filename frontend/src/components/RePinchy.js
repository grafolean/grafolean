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
    initialState: {
      x: 0,
      y: 0,
      scale: 1.0,
    },
    minScale: 2.8837376326873415e-7,
    maxScale: 128.0,
    touchScaleFactorDisabledBetween: [0.7, 1.4],  // this allows pan without zoom with (inaccurate) touchscreen gestures
    wheelScaleFactor: 1.1,  // how fast wheel zooms in/out
    renderSub: (x, y, scale) => {
      return <p>Please specify renderSub prop!</p>
    }
  };


  constructor() {
    super(...arguments);

    this.x = this.props.initialState.x;
    this.y = this.props.initialState.y;
    this.scale = this.props.initialState.scale || 1.0;
    this.zoomInProgress = false;
    this.twinTouch = null;  // internal data about progress of twin finger touch
    this.mouseMoveState = null;  // internal data abour progress of mouse pan operation (drag to pan)

    this.state = {
      x: this.x,
      y: this.y,
      scale: this.scale,

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
    this.updateTwinTouchMoveCoords = this.updateTwinTouchMoveCoords.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.killTouchHandler = this.killTouchHandler.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseMoveCheckCtrl = this.handleMouseMoveCheckCtrl.bind(this);
    this.updateMouseMoveCoords = this.updateMouseMoveCoords.bind(this);
    this.handleClickCapture = this.handleClickCapture.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleCtrlKeyUp = this.handleCtrlKeyUp.bind(this);
    this.clearOverlay = this.clearOverlay.bind(this);
    this.onTestButtonClick = this.onTestButtonClick.bind(this);
  }

  componentDidMount(){
    document.addEventListener("keyup", this.handleCtrlKeyUp, true);
  }
  componentWillUnmount(){
    document.removeEventListener("keyup", this.handleCtrlKeyUp, true);
  }

  killTouchHandler(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
  }

  killTouch() {
    document.body.style.touchAction = 'none';
    document.getElementById('root').style.touchAction = 'none';
    // document.body.addEventListener("touchstart", this.killTouchHandler, true);
    // document.body.addEventListener("touchmove", this.killTouchHandler, true);
    // document.body.addEventListener("touchstart", this.killTouchHandler, false);
    // document.body.addEventListener("touchmove", this.killTouchHandler, false);
    // document.addEventListener("touchstart", this.killTouchHandler, true);
    // document.addEventListener("touchmove", this.killTouchHandler, true);
    document.addEventListener("touchstart", this.killTouchHandler, false);
    document.addEventListener("touchmove", this.killTouchHandler, false);
  }

  resurrectTouch() {
    document.body.style.touchAction = 'auto';
    document.getElementById('root').style.touchAction = 'auto';
    // document.body.removeEventListener("touchstart", this.killTouchHandler, true);
    // document.body.removeEventListener("touchmove", this.killTouchHandler, true);
    // document.body.removeEventListener("touchstart", this.killTouchHandler, false);
    // document.body.removeEventListener("touchmove", this.killTouchHandler, false);
    // document.removeEventListener("touchstart", this.killTouchHandler, true);
    // document.removeEventListener("touchmove", this.killTouchHandler, true);
    document.removeEventListener("touchstart", this.killTouchHandler, false);
    document.removeEventListener("touchmove", this.killTouchHandler, false);
  }

  // https://reactjs.org/docs/events.html
  handleTouchStart(event) {
    // if not double touch, just ignore it. You have no idea if a twin touch will follow or not.
    if (event.touches.length === 2) {
      if (!this.twinTouch) {  // just in case this gets called twice... not sure if it can happen, better safe than sorry
        this.clearOverlay();
        this.handleTwinTouchStart(event);
        this.killTouch();
      }
    }
  }

  handleTouchMove(event) {
    // https://blog.mobiscroll.com/working-with-touch-events/
    // " In Firefox Mobile the native scroll can be killed only if preventDefault() is called on the
    //   touchstart event. Unfortunately at touchstart we don’t really know if we want scroll or not."
    console.log("touchmove", event.touches.length)
    if (event.touches.length === 1) {
      if (this.twinTouch) {
        // are we already in the middle of twin touch session? Just ignore this event.
        return;
      };
      this.ensureOverlayShown("Use 2 fingers to zoom and pan");
      return;
    }
    if (event.touches.length === 2) {
      // document.getElementsByTagName('body').style.touchAction = 'none';  // disable
      // possible solution:
    //   document.body.addEventListener("touchmove", function(event) {
    //     event.preventDefault();
    //     event.stopPropagation();
    // }, true);

      this.clearOverlay();
      this.handleTwinTouchMove(event);
    }
  }

  handleTouchEnd(event) {
    console.log("touchend", event.touches.length)
    if (this.twinTouch) {
      this.resurrectTouch();
    };
    // when touch ends, it ends - it doesn't matter with how many fingers:
    this.handleTwinTouchEnd(event);
  }

  _getTwinTouchDims(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      dx: event.touches[0].clientX - event.touches[1].clientX,
      dy: event.touches[0].clientY - event.touches[1].clientY,
      x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left - this.props.padLeft,
      y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top,
    }
  };

  handleTwinTouchStart(event) {
    const startTwinTouch = this._getTwinTouchDims(event);
    this.twinTouch = {
      x: startTwinTouch.x,
      y: startTwinTouch.y,
      dist: Math.sqrt(startTwinTouch.dx * startTwinTouch.dx + startTwinTouch.dy * startTwinTouch.dy),
      zoomStartState: {  // remember old state so you can apply transformations from it; should be much more accurate
        x: this.x,
        y: this.y,
        scale: this.scale,
      },
      animationId: null,
      newTwinTouchDims: null,
      allowScaling: false,  // initially disable scale until scale factor leaves forbidden area
    };
    this.zoomInProgress = true;
    this.setState({
      zoomInProgress: this.zoomInProgress,
    });
  }

  updateTwinTouchMoveCoords() {
    /*
      We have 2 actions user can perform with multitouch / twin touch:
      - zoom in/out (pinch)
      - pan
    */
    this.twinTouch.animationId = null;

    const dist = Math.sqrt(this.twinTouch.newTwinTouchDims.dx * this.twinTouch.newTwinTouchDims.dx + this.twinTouch.newTwinTouchDims.dy * this.twinTouch.newTwinTouchDims.dy);
    let scaleFactor = dist / this.twinTouch.dist;
    if (!this.twinTouch.allowScaling) {  // check if user has broken out of "forbidden scaling" area - if yes, allow any scale factor:
      if (scaleFactor < this.props.touchScaleFactorDisabledBetween[0] || scaleFactor > this.props.touchScaleFactorDisabledBetween[1]) {
        this.twinTouch.allowScaling = true;
      }
    };
    if (!this.twinTouch.allowScaling) {
      scaleFactor = 1.0;
    }

    this.x = this.twinTouch.newTwinTouchDims.x - (this.twinTouch.x - this.twinTouch.zoomStartState.x) * scaleFactor;
    this.y = this.twinTouch.newTwinTouchDims.y - (this.twinTouch.y - this.twinTouch.zoomStartState.y) * scaleFactor;
    this.scale = this.twinTouch.zoomStartState.scale * scaleFactor;
    this.setState({
      x: this.x,
      y: this.y,
      scale: this.scale,
    });
  }

  handleTwinTouchMove(event) {
    if ((this.twinTouch === null) || (!this.zoomInProgress)) {
      return;
    };
    // just remember the data about touch:
    this.twinTouch.newTwinTouchDims = this._getTwinTouchDims(event);
    // ...and schedule update:
    if (this.twinTouch.animationId === null) {
      this.twinTouch.animationId = requestAnimationFrame(this.updateTwinTouchMoveCoords);
    };

  }

  handleTwinTouchEnd(event) {
    if (this.twinTouch && this.twinTouch.animationId !== null) {
      // updateTwinTouchMoveCoords would have trouble updating without data, so let's cancel its invocation:
      cancelAnimationFrame(this.twinTouch.animationId);
    };
    this.twinTouch = null;
    this.zoomInProgress = false;
    this.setState({
      zoomInProgress: this.zoomInProgress,
    });
  }


  handleWheel(event) {
    if (!event.ctrlKey) {
      this.log("Wheel", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
      this.ensureOverlayShown("Use CTRL + mouse wheel to zoom");
      return;
    }

    let currentTargetRect = event.currentTarget.getBoundingClientRect();

    this.log("Wheel CTRL!", event.deltaMode, event.deltaX, event.deltaY, event.deltaZ);
    const event_offsetX = event.pageX - currentTargetRect.left - this.props.padLeft;
    const event_offsetY = event.pageY - currentTargetRect.top;

    this.zoomInProgress = true;
    this.setState({
      zoomInProgress: this.zoomInProgress,
    });
    // listening for keyUp for Ctrl doesn't always work for unknown reasons (not because of onblur), so
    // we use a failsafe:
    window.addEventListener('mousemove', this.handleMouseMoveCheckCtrl, true);

    let scaleFactor;
    if (event.deltaY < 0) {
      scaleFactor = this.props.wheelScaleFactor;
    }
    else if (event.deltaY > 0) {
      scaleFactor = 1.0 / this.props.wheelScaleFactor;
    }
    else {
      return;  // not sure if this can happen, but let's play safe
    }


    let newScale = this.scale * scaleFactor;
    // check scale boundaries:
    if (newScale < this.props.minScale || newScale > this.props.maxScale) {
      return;  // nothing to do - scaling out of bounds / not allowed
    };

    this.x = event_offsetX - (event_offsetX - this.x) * scaleFactor;
    this.y = event_offsetY - (event_offsetY - this.y) * scaleFactor;
    this.scale = newScale;

    this.setState({
      x: this.x,
      y: this.y,
      scale: this.scale,
    });

    event.preventDefault();
  }

  handleCtrlKeyUp(event) {
    if (event.keyCode === 17) {
      this.onCtrlKeyUp();
    }
  }

  // safeguard because sometimes handleCtrlKeyUp() is not called :
  handleMouseMoveCheckCtrl(event) {
    // https://stackoverflow.com/a/8875522/593487
    if (event.ctrlKey) {
      return;  // it seems all is ok (Ctrl is still pressed)
    };
    console.log("KeyUp event failed to detect Ctrl key up, fixing with workaround")
    this.onCtrlKeyUp();
  }

  onCtrlKeyUp() {
    this.zoomInProgress = false;
    this.setState({
      zoomInProgress: this.zoomInProgress,
    });
    window.removeEventListener('mousemove', this.handleMouseMoveCheckCtrl, true);  // no need for the workaround anymore
  }

  handleMouseDown(event) {
    // mouse drag started, let's remember everything we need to know to follow it:
    this.mouseMoveState = {
      startState: {
        x: this.state.x,
        y: this.state.y,
        scale: this.state.scale,
      },
      mouseDownEvent: {
        clientX: event.clientX,
        clientY: event.clientY,
      },
      dirty: false,  // this flag makes checking if something has changed much easier
      animationId: null,
    }

    // we need to listen for mousemove/up anywhere, not just over our component, so we need to
    // register event listener manually:
    window.addEventListener('mouseup', this.handleMouseUp, true);
    window.addEventListener('mousemove', this.handleMouseMove, true);

    event.preventDefault();
  }

  updateMouseMoveCoords() {
    // remember that we have updated state so it can be scheduled next time again:
    this.mouseMoveState.animationId = null;

    this.x = this.mouseMoveState.startState.x + (this.mouseMoveState.mouseMoveEvent.clientX - this.mouseMoveState.mouseDownEvent.clientX);
    this.y = this.mouseMoveState.startState.y + (this.mouseMoveState.mouseMoveEvent.clientY - this.mouseMoveState.mouseDownEvent.clientY);
    this.setState({
      x: this.x,
      y: this.y,
    });
  }

  handleMouseMove(event) {
    if (!this.mouseMoveState) {
      return;
    };
    this.mouseMoveState.mouseMoveEvent = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    // if updating is not yet scheduled for, schedule it:
    if (this.mouseMoveState.animationId === null) {
      this.mouseMoveState.animationId = requestAnimationFrame(this.updateMouseMoveCoords);
    };
  }

  handleMouseUp(event) {
    // event listener did its work, now unregister it:
    window.removeEventListener('mouseup', this.handleMouseUp, true);
    window.removeEventListener('mousemove', this.handleMouseMove, true);
    if (this.mouseMoveState.animationId !== null) {
      // updateMouseMoveCoords would have trouble updating without data, so let's cancel its invocation:
      cancelAnimationFrame(this.mouseMoveState.animationId);
    };
    this.mouseMoveState = null;
    event.preventDefault();
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
      };
    });
  }

  ensureOverlayShown(msg) {
    if (this.clearOverlayTimeoutHandle) {
      clearTimeout(this.clearOverlayTimeoutHandle);
      this.clearOverlayTimeoutHandle = null;
    };
    this.clearOverlayTimeoutHandle = setTimeout(this.clearOverlay, 2000);

    this.setState((oldState) => {
      return {
        overlay: {
          shown: true,
          msg: msg,
        }
      }
    });
  }

  clearOverlay() {
    if (!this.clearOverlayTimeoutHandle) {
      return;
    };
    clearTimeout(this.clearOverlayTimeoutHandle);
    this.clearOverlayTimeoutHandle = null;
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
          onTouchStartCapture={this.handleTouchStart}
          onTouchMoveCapture={this.handleTouchMove}
          onTouchEndCapture={this.handleTouchEnd}
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
            touchAction: 'auto',
          }}
          >

          {
            // There must be exactly one child which is a function, returning elements to be rendered. Example:
            // <RePinchy
            //   width={600}
            //   height={300}
            //   padLeft={60}
            //   initialState={{
            //     x: -1234567820.0,
            //     y: 0.0,
            //     scale: 1.0,
            //   }}>
            //   {(w, h, x, y, scale, zoomInProgress) => (
            //     <MoonChart ...props />
            //   )}
            // </RePinchy>
          }
          {this.props.children(this.state.x, this.state.y, this.state.scale, this.state.zoomInProgress)}

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