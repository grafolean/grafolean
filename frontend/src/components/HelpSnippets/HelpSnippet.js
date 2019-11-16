import React from 'react';

export default class HelpSnippet extends React.Component {
  state = {
    opened: this.props.initiallyOpened !== undefined ? this.props.initiallyOpened : true,
  }

  toggleOpened = () => {
    this.setState(prevState => ({
      opened: !prevState.opened,
    }));
  }

  render() {
    const { title } = this.props;
    const { opened } = this.state;
    return (
      <div className="help-snippet frame">
        <h1 onClick={this.toggleOpened}>
          <i className={`fa ${opened ? 'fa-chevron-down' : 'fa-chevron-right'}`} /> {title}
        </h1>
        {opened && this.props.children}
      </div>
    );
  }
}
