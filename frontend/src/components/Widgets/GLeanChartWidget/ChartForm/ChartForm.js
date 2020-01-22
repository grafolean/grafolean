import React from 'react';
import { compile } from 'mathjs';

import MatchingPaths from './MatchingPaths';
import Button from '../../../Button';
import UnitFormField from '../../UnitFormField';

import './ChartForm.scss';

export default class ChartForm extends React.Component {
  static DEFAULT_SERIE_GROUP_CONTENT = {
    path_filter: '',
    renaming: '',
    expression: '$1',
    unit: '',
  };
  static DEFAULT_FORM_CONTENT = [ChartForm.DEFAULT_SERIE_GROUP_CONTENT];

  static validate = content => {
    if (content.length === 0) {
      return 'At least one chart series group must be defined';
    }
    for (let i = 0; i < content.length; i++) {
      try {
        compile(content[i].expression);
      } catch (err) {
        return {
          [i]: {
            expression: 'Error compiling an expression',
          },
        };
      }
    }
    // all is ok:
    return {};
  };

  userUnitCreator = option => {
    return {
      value: option.label,
      label: option.label,
    };
  };

  handleAddEmptySerie = ev => {
    this.props.setFieldValue('content', [...this.props.content, ChartForm.DEFAULT_SERIE_GROUP_CONTENT]);
    ev.preventDefault();
  };

  getOtherKnownUnits() {
    let otherUnits = [];
    // we need to list all possible units, otherwise they won't be visible as selected options:
    for (let sg of this.props.content) {
      if (sg.unit === '') {
        continue;
      }
      if (otherUnits.find(u => u.value === sg.unit)) {
        // we already know this unit, skip it
        continue;
      }
      otherUnits.push({
        value: sg.unit,
        label: sg.unit,
        allowedPrefixes: null,
      });
    }
    return otherUnits;
  }

  render() {
    const { content: seriesGroups, onChange, onBlur, setFieldValue } = this.props;
    const otherKnownUnits = this.getOtherKnownUnits();
    return (
      <div className="chart-form">
        <div className="field">
          <label>Chart series:</label>
          {seriesGroups.map((sg, sgIndex) => (
            <div className="serie" key={sgIndex}>
              <div className="form-item">
                <div className="top-part">
                  <div className="left-column">
                    <div className="field">
                      <label>Path filter:</label>
                      <input
                        type="text"
                        value={sg.path_filter}
                        name={`content[${sgIndex}].path_filter`}
                        onChange={onChange}
                        onBlur={onBlur}
                      />
                      <p className="hint markdown">
                        `*` (multiple segments) and `?` (single segment) wildcards can be used.
                      </p>
                    </div>
                    <div className="field">
                      <label>Series label:</label>
                      <input
                        type="text"
                        value={sg.renaming}
                        name={`content[${sgIndex}].renaming`}
                        onChange={onChange}
                        onBlur={onBlur}
                      />
                      <p className="hint markdown">
                        Hint: Use `$1` to reference first replaced part, `$2` for the second,... Leave empty
                        to display the whole path instead.
                      </p>
                    </div>
                  </div>

                  <MatchingPaths pathFilter={sg.path_filter} pathRenamer={sg.renaming} displayPaths={true} />
                </div>

                <div className="field">
                  <label>Expression for modifying values:</label>
                  <input
                    type="text"
                    value={sg.expression}
                    name={`content[${sgIndex}].expression`}
                    onChange={onChange}
                    onBlur={onBlur}
                  />
                  <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
                </div>
              </div>

              <UnitFormField
                value={sg.unit || ''}
                name={`content[${sgIndex}].unit`}
                otherKnownUnits={otherKnownUnits}
                onChange={onChange}
                onBlur={onBlur}
                setFieldValue={setFieldValue}
              />
            </div>
          ))}
          <Button onClick={this.handleAddEmptySerie}>+</Button>
        </div>
      </div>
    );
  }
}
