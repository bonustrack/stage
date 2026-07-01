import { describe, test } from 'bun:test';
import { groupFieldEditor } from '../src/group/groupFieldEditor';
import { labelRow } from '../src/group/labelRow';
import { snap } from './helpers';

describe('labelRow', () => {
  test('minimal', () => {
    snap(labelRow({ labels: [{ label: 'work' }], background: '#eeeeee' }));
  });

  test('full', () => {
    snap(
      labelRow({
        labels: [{ label: 'work', removable: true }, { label: 'dao' }],
        background: '#eeeeee',
        removeType: 'custom.remove',
      }),
    );
  });
});

const EDITOR_BASE = {
  field: 'name' as const,
  value: 'DAO Ops',
  placeholder: 'Group name',
  label: 'Save',
  disabled: false,
  primary: '#0a7cff',
  bg: '#ffffff',
  fg: '#111111',
  sub: '#666666',
  border: '#dddddd',
  inputBg: '#f7f7f7',
};

describe('groupFieldEditor', () => {
  test('minimal (single-line name)', () => {
    snap(groupFieldEditor(EDITOR_BASE));
  });

  test('full (multiline description, disabled save, custom types)', () => {
    snap(
      groupFieldEditor({
        ...EDITOR_BASE,
        field: 'description',
        value: 'What we do',
        placeholder: 'Group description',
        disabled: true,
        multiline: true,
        minHeight: 80,
        changeType: 'custom.change',
        saveType: 'custom.save',
      }),
    );
  });
});
