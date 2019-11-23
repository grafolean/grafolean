import React from 'react';
import isFormikForm from '../isFormikForm';

class ChangePasswordFormRender extends React.Component {
  static validate = values => {
    const { oldPassword = '', newPassword = '', confirmPassword = '' } = values;
    if (!oldPassword) {
      return { oldPassword: 'Old password is required' };
    }
    if (!newPassword) {
      return { newPassword: 'New password must not be empty' };
    }
    if (newPassword !== confirmPassword) {
      return { confirmPassword: 'Confirmation password does not match new password' };
    }
    return {};
  };

  render() {
    const {
      values: { oldPassword = '', newPassword = '', confirmPassword = '' },
      onChange,
      onBlur,
    } = this.props;

    return (
      <div className="frame">
        <div className="field">
          <label>Old password:</label>
          <input type="password" value={oldPassword} name="oldPassword" onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="field">
          <label>New password:</label>
          <input type="password" value={newPassword} name="newPassword" onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="field">
          <label>Confirm password:</label>
          <input
            type="password"
            value={confirmPassword}
            name="confirmPassword"
            onChange={onChange}
            onBlur={onBlur}
          />
        </div>
      </div>
    );
  }
}
export default isFormikForm(ChangePasswordFormRender);
