import React from 'react';

export default class HelpSnippet extends React.Component {
  render() {
    const { title, icon, className } = this.props;
    return (
      <div className={`help-snippet frame ${className || ''}`}>
        <h1>
          <i className={`fa ${icon ? icon : 'fa-info-circle'} fa-fw`} /> {title}
        </h1>
        {this.props.children}
      </div>
    );
  }
}
