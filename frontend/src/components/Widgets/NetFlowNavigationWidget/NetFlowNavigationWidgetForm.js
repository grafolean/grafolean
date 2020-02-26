import React from 'react';

export default class NetFlowNavigationWidgetForm extends React.Component {
  static DEFAULT_FORM_CONTENT = {
    whatever: '',
  };

  render() {
    const { content, onChange, onBlur } = this.props;
    if (!content || Object.keys(content).length === 0) {
      return null;
    }
    const { whatever = '' } = content;
    return (
      <div className="netflow-navigation-form">
        <div className="field">
          <label>Construct label:</label>
          <input type="text" value={whatever} name={`content.whatever`} onChange={onChange} onBlur={onBlur} />
        </div>
      </div>
    );
  }
}
