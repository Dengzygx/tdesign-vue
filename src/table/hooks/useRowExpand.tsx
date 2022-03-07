import { computed, SetupContext, toRefs } from '@vue/composition-api';
import { ChevronRightCircleIcon } from 'tdesign-icons-vue';
import get from 'lodash/get';
import { CreateElement } from 'vue';
import {
  TdPrimaryTableProps,
  PrimaryTableCol,
  TableRowData,
  PrimaryTableCellParams,
  TableExpandedRowParams,
  RowEventContext,
} from '../type';
import useClassName from './useClassName';
import { useTNodeJSX } from '../../hooks/tnode';
import useDefaultValue from '../../hooks/useDefaultValue';
import { TableConfig, useConfig } from '../../config-provider/useConfig';

export default function useRowExpand(props: TdPrimaryTableProps, context: SetupContext) {
  const { expandedRowKeys } = toRefs(props);
  const renderTNode = useTNodeJSX();
  const { t, global } = useConfig<TableConfig>('table');
  const { tableExpandClasses } = useClassName();
  // controlled and uncontrolled
  const [tExpandedRowKeys, setTExpandedRowKeys] = useDefaultValue(
    expandedRowKeys,
    props.defaultExpandedRowKeys,
    props.onExpandChange,
    context.emit,
    'expandedRowKeys',
    'expand-change',
  );

  const showExpandedRow = computed(() => Boolean(props.expandedRow || context.slots.expandedRow || context.slots['expanded-row']));

  const showExpandIconColumn = computed(() => props.expandIcon !== false && showExpandedRow.value);

  const isFirstColumnFixed = computed(() => props.columns?.[0]?.fixed === 'left');

  const onToggleExpand = (e: MouseEvent, row: TableRowData) => {
    props.expandOnRowClick && e.stopPropagation();
    const currentId = get(row, props.rowKey || 'id');
    const index = tExpandedRowKeys.value.indexOf(currentId);
    const newKeys = [...tExpandedRowKeys.value];
    index !== -1 ? newKeys.splice(index, 1) : newKeys.push(currentId);
    setTExpandedRowKeys(newKeys, {
      expandedRowData: props.data.filter((t) => newKeys.includes(get(t, props.rowKey || 'id'))),
    });
  };

  // eslint-disable-next-line
  const renderExpandIcon = (h: CreateElement, p: PrimaryTableCellParams<TableRowData>) => {
    const { row, rowIndex } = p;
    const currentId = get(row, props.rowKey || 'id');
    const expanded = tExpandedRowKeys.value.includes(currentId);
    // TODO: GLOBLE_CONFIG expandIcon
    const icon = renderTNode('expandIcon', {
      defaultNode: t(global.value.expandIcon) || <ChevronRightCircleIcon />,
      params: { row, index: rowIndex },
    });
    if (!icon) return null;
    const styles = { transform: expanded ? 'rotate(90deg)' : undefined };
    return (
      <span class={tableExpandClasses.iconBox} style={styles} onClick={(e: MouseEvent) => onToggleExpand(e, row)}>
        {icon}
      </span>
    );
  };

  // eslint-disable-next-line
  const getExpandColumn = (h: CreateElement) => {
    const expandCol: PrimaryTableCol<TableRowData> = {
      colKey: '__EXPAND_ROW_ICON_COLUMN__',
      width: 64,
      className: tableExpandClasses.iconCell,
      fixed: isFirstColumnFixed.value ? 'left' : undefined,
      cell: renderExpandIcon,
    };
    return expandCol;
  };

  // eslint-disable-next-line
  const renderExpandedRow = (h: CreateElement, p: TableExpandedRowParams<TableRowData>) => {
    if (!tExpandedRowKeys.value.includes(get(p.row, props.rowKey || 'id'))) return null;
    return (
      <tr class={tableExpandClasses.row}>
        <td colspan={p.columns.length} class={tableExpandClasses.td}>
          <div class={tableExpandClasses.rowInner}>{renderTNode('expandedRow', { params: p })}</div>
        </td>
      </tr>
    );
  };

  const onInnerExpandRowClick = (p: RowEventContext<TableRowData>) => {
    onToggleExpand(p.e, p.row);
  };

  return {
    showExpandedRow,
    showExpandIconColumn,
    getExpandColumn,
    renderExpandedRow,
    onInnerExpandRowClick,
  };
}