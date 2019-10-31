import React from 'react';

export default class HelpSnippet extends React.Component {
  render() {
    const { title, icon = 'info-circle' } = this.props;
    return (
      <div className="help-snippet frame">
        <h1>
          <i className={`fa fa-${icon}`} /> {title}
        </h1>
        {this.props.children}
      </div>
    );
  }
}
