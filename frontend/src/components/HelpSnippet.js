import React from 'react';

export default class HelpSnippet extends React.Component {
  render() {
    const { title } = this.props;
    return (
      <div className="bot-help frame">
        <h1>
          <i className="fa fa-question-circle" /> {title}
        </h1>
        {this.props.children}
      </div>
    );
  }
}
