import React from 'react';
import { withRouter } from 'react-router-dom';

import Button from '../Button';

/*
  This component is the same as react-router's Link, except that it generates <button> DOM element instead of <a>.
*/
class LinkButton extends React.PureComponent {
  handleClick = ev => {
    const { to, history, onClick } = this.props;
    history.push(to);
    if (onClick) {
      onClick(ev);
    }
  };

  render() {
    // remove props which are needed only for Link (including staticContext which gets added by withRouter HOC) so
    // that we can pass ...rest and children to the Button component:
    const { children, onClick, to, history, staticContext, ...rest } = this.props;
    return (
      <Button onClick={this.handleClick} {...rest}>
        {children}
      </Button>
    );
  }
}

export default withRouter(LinkButton);
