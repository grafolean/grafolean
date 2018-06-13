import React from 'react';

export default class WidgetDialog extends React.Component {
  static defaultProps = {
    width: 100,
    height: 100,
    padding: 20,
    onCloseAttempt: () => {},
  }

  render() {
    return (
      <div>
        <div
          className="widget-dialog-overlay"
          style={{
            width: this.props.width,
            height: this.props.opened ? this.props.height + 2*this.props.padding : 0,
            opacity: this.props.opened ? 0.1 : 0,
          }}
          onClick={this.props.onCloseAttempt}
        >
        </div>

        <div
          className="widget-dialog"
          style={{
            width: this.props.width - 2*this.props.padding,
            opacity: this.props.opened ? 1 : 0,
            zIndex: this.props.opened ? 9999 : -1,  // you need to send it to back, otherwise it floats before our chart
          }}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}

