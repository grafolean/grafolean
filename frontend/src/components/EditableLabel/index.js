import React from 'react';

import './EditableLabel.scss';

export default class EditableLabel extends React.PureComponent {
  state = {
    editing: false,
    newLabel: null,
  };

  startEdit = () => {
    this.setState({
      editing: true,
      newLabel: this.props.label,
    });
  };

  acceptEdit = () => {
    this.setState({
      editing: false,
      newLabel: null,
    });
    this.props.onChange(this.state.newLabel);
  };

  rejectEdit = () => {
    this.setState({
      editing: false,
      newLabel: null,
    });
  };

  handleLabelChange = ev => {
    this.setState({
      newLabel: ev.target.value,
    });
  };

  render() {
    const { label, isEditable } = this.props;
    const { editing, newLabel } = this.state;
    return (
      <span className="editable-label label">
        {editing ? (
          <>
            <input type="text" value={newLabel} onChange={this.handleLabelChange} />
            <i className="fa fa-check" onClick={this.acceptEdit} />
            <i className="fa fa-close" onClick={this.rejectEdit} />
          </>
        ) : (
          <>
            {label} {isEditable && <i className="fa fa-pencil" onClick={this.startEdit} />}
          </>
        )}
      </span>
    );
  }
}
