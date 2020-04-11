import React from 'react';

export default class NetFlowNavigationWidgetForm extends React.Component {
  static DEFAULT_FORM_CONTENT = {};

  render() {
    return (
      <div className="netflow-navigation-form">
        <div className="field">
          <p className="hint">This widget type has no further options.</p>
        </div>
      </div>
    );
  }
}
