import React from 'react';

import isFormikForm from '../isFormikForm';
import { SUPPORTED_PROTOCOLS } from '../../utils/protocols';

class BotFormRender extends React.Component {
  static validate = values => {
    const { name = '' } = values;
    if (!name) {
      return { oldPassword: 'Name is required' };
    }
    return {};
  };

  render() {
    const {
      values: { name = '', protocol = '' },
      onChange,
      onBlur,
      setFieldValue,
    } = this.props;
    return (
      <>
        <div className="field">
          <label>Name:</label>
          <input type="text" name="name" value={name} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="field">
          <label>Protocol:</label>
          <span
            className={`protocol-choice ${!protocol && 'chosen'}`}
            value=""
            onClick={() => setFieldValue('protocol', '')}
          >
            Custom
          </span>
          {SUPPORTED_PROTOCOLS.map(p => (
            <span
              key={p.slug}
              className={`protocol-choice ${p.slug === protocol && 'chosen'}`}
              value={p.slug}
              onClick={() => setFieldValue('protocol', p.slug)}
            >
              {p.label}
            </span>
          ))}
        </div>
      </>
    );
  }
}
export default isFormikForm(BotFormRender);
