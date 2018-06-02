import React from 'react';

export default class WidgetTitleBar extends React.Component {
  render() {
    return (
      <div className="widget-title">
        <h1>{this.props.title}</h1>
        {this.props.buttonRenders.map((renderButton, i) => (
          <span
            key={i}
            className="widget-button"
          >
            {renderButton}
          </span>
        ))}
      </div>
    )
  }
}