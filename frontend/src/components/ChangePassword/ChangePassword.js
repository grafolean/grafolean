import React from 'react';
import { connect } from 'react-redux';

import ChangePasswordFormRender from './ChangePasswordFormRender';

class ChangePassword extends React.Component {
  fixValuesBeforeSubmit = formValues => {
    return {
      old_password: formValues.oldPassword,
      new_password: formValues.newPassword,
    };
  };

  render() {
    const { userId } = this.props;
    return (
      <ChangePasswordFormRender
        resource={`persons/${userId}/password`}
        fixValuesBeforeSubmit={this.fixValuesBeforeSubmit}
      />
    );
  }
}

const mapStoreToProps = store => ({
  userId: store.user.user_id,
});
export default connect(mapStoreToProps)(ChangePassword);
