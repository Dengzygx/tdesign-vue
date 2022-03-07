import { SetupContext, computed } from '@vue/composition-api';
import { CreateElement } from 'vue';
import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import get from 'lodash/get';
import pick from 'lodash/pick';
import TrElement, { TrProps, ROW_LISTENERS, TABLE_PROPS } from '../tr';
import { TableConfig, useConfig } from '../../config-provider/useConfig';
import {
  RowspanColspan, TdBaseTableProps, TableRowData, BaseTableCellParams,
} from '../type';
import { BaseTableProps } from '../interface';
import { RowAndColFixedPosition } from './useFixed';
import { useTNodeJSX } from '../../hooks/tnode';
import useClassName from './useClassName';

export const ROW_AND_TD_LISTENERS = ROW_LISTENERS.concat('cell-click');

export interface RenderTableBodyParams {
  data: TdBaseTableProps['data'];
  columns: TdBaseTableProps['columns'];
  // 固定列 left/right 具体值
  rowAndColFixedPosition: RowAndColFixedPosition;
  showColumnShadow: { left: boolean; right: boolean };
  translateY: object;
  scrollType: string;
  rowHeight: number;
  trs: Map<number, object>;
  bufferSize: number;
  handleRowMounted: Function;
}

export default function useTableBody(props: BaseTableProps, { emit, slots }: SetupContext) {
  const renderTNode = useTNodeJSX();
  const { t, global } = useConfig<TableConfig>('table');
  const { tableFullRowClasses, tableBaseClass } = useClassName();

  const tbodyClases = computed(() => [tableBaseClass.body]);

  const getTrListeners = () => {
    const trListeners: { [eventName: string]: (e: MouseEvent) => void } = {};
    // add events to row
    ROW_AND_TD_LISTENERS.forEach((eventName) => {
      const name = ['cell-click'].includes(eventName) ? eventName : `row-${eventName}`;
      trListeners[name] = (context) => {
        props[`onRow${upperFirst(eventName)}`]?.(context);
        // Vue3 ignore this line
        emit(name, context);
      };
    });
    return trListeners;
  };

  const getFullRow = (
    // eslint-disable-next-line
    h: CreateElement,
    columnLength: number,
    fullRow: TdBaseTableProps['firstFullRow'],
    type: 'first-full-row' | 'last-full-row',
  ) => {
    if (!fullRow) return null;
    const fullRowNode = renderTNode(camelCase(type));
    if (['', null, undefined, false].includes(fullRowNode)) return null;
    const classes = [tableFullRowClasses.base, tableFullRowClasses[type]];
    return (
      <tr class={classes}>
        <td colspan={columnLength}>{fullRowNode}</td>
      </tr>
    );
  };

  // eslint-disable-next-line
  const renderEmpty = (h: CreateElement, columns: RenderTableBodyParams['columns']) => (
    <tr class={tableBaseClass.emptyRow}>
      <td colspan={columns.length}>
        <div class={tableBaseClass.empty}>{renderTNode('empty') || t(global.value.empty)}</div>
      </td>
    </tr>
  );

  // 受合并单元格影响，部分单元格不显示
  let skipSpansMap = new Map<any, boolean>();

  const onTrRowspanOrColspan = (params: BaseTableCellParams<TableRowData>, cellSpans: RowspanColspan) => {
    const { rowIndex, colIndex } = params;
    if (!cellSpans.rowspan && !cellSpans.colspan) return;
    const maxRowIndex = rowIndex + (cellSpans.rowspan || 1);
    const maxColIndex = colIndex + (cellSpans.colspan || 1);
    for (let i = rowIndex; i < maxRowIndex; i++) {
      for (let j = colIndex; j < maxColIndex; j++) {
        if (i !== rowIndex || j !== colIndex) {
          skipSpansMap.set([i, j].join(), true);
        }
      }
    }
  };

  // eslint-disable-next-line
  const renderTableBody = (h: CreateElement, p: RenderTableBodyParams) => {
    const {
      rowAndColFixedPosition,
      data,
      columns,
      scrollType,
      rowHeight,
      trs,
      bufferSize,
      handleRowMounted,
      translateY,
    } = p;
    const columnLength = columns.length;
    const trNodeList: JSX.Element[] = [];
    // 每次渲染清空合并单元格信息
    skipSpansMap = new Map<any, boolean>();
    const dataLength = data.length;

    data?.forEach((row, rowIndex) => {
      const trProps: TrProps = {
        ...pick(props, TABLE_PROPS),
        columns,
        row,
        rowIndex,
        dataLength,
        rowAndColFixedPosition,
        skipSpansMap,
        // 遍历的同时，计算后面的节点，是否会因为合并单元格跳过渲染
        onTrRowspanOrColspan,
        scrollType,
        rowHeight,
        trs,
        bufferSize,
      };
      if (props.onCellClick) {
        trProps.onCellClick = props.onCellClick;
      }
      // Vue3 do not need getTrListeners
      const on: { [keys: string]: Function } = getTrListeners();
      if (handleRowMounted) {
        on.onRowMounted = handleRowMounted;
      }

      const trNode = (
        <TrElement scopedSlots={slots} key={get(row, props.rowKey || 'id')} on={on} props={trProps}></TrElement>
      );
      trNodeList.push(trNode);

      // 执行展开行渲染
      if (props.renderExpandedRow) {
        const expandedContent = props.renderExpandedRow(h, { row, index: rowIndex, columns });
        expandedContent && trNodeList.push(expandedContent);
      }
    });

    const list = [
      getFullRow(h, columnLength, props.firstFullRow, 'first-full-row'),
      trNodeList,
      getFullRow(h, columnLength, props.lastFullRow, 'last-full-row'),
    ];
    const isEmpty = !data?.length && !props.loading;

    return (
      <tbody
        class={tbodyClases.value}
        style={scrollType === 'virtual' && { transform: `translate(0, ${translateY}px)` }}
      >
        {isEmpty ? renderEmpty(h, columns) : list}
      </tbody>
    );
  };

  return {
    renderTableBody,
  };
}