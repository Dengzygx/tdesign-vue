import { SetupContext, h, computed } from '@vue/composition-api';
import get from 'lodash/get';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import { prefix } from '../../config';
import {
  TABLE_CLASS_BODY,
  TABLE_TD_ELLIPSIS_CLASS,
  TAVLE_CLASS_VERTICAL_ALIGN,
  TABLE_CLASS_EMPTY,
  TABLE_CLASS_EMPTY_ROW,
  TABLE_TD_LAST_ROW,
} from './useStyle';
import {
  BaseTableCellParams, RowspanColspan, TableRowData, TdBaseTableProps,
} from '../type';
import { BaseTableProps } from '../interface';
import { ColumnStickyLeftAndRight, getColumnFixedStyles, getRowFixedStyles } from './useFixed';
import { useTNodeJSX } from '../../hooks/tnode';
// import isObject from 'lodash/isObject';
import TEllipsis from '../ellipsis';

export interface RenderEllipsisCellParams {
  columnLength: number;
  cellNode: any;
}

export interface RenderTableBodyParams {
  data: TdBaseTableProps['data'];
  columns: TdBaseTableProps['columns'];
  // 固定列 left/right 具体值
  columnStickyLeftAndRight: ColumnStickyLeftAndRight;
  showColumnShadow: { left: boolean; right: boolean };
}

export interface RenderTdExtra {
  columnStickyLeftAndRight: ColumnStickyLeftAndRight;
  columnLength: number;
  dataLength: number;
  cellSpans: RowspanColspan;
}

export const ROW_LISTENERS = {
  click: 'onRowClick',
  dbclick: 'onRowDbClick',
  hover: 'onRowHover',
  mousedown: 'onRowMousedown',
  mouseenter: 'onRowMouseenter',
  mouseleave: 'onRowMouseleave',
  mouseup: 'onRowMouseup',
};

export default function useTableBody(props: BaseTableProps, { emit, slots }: SetupContext) {
  const tbodyClases = computed(() => [
    TABLE_CLASS_BODY,
    { [TAVLE_CLASS_VERTICAL_ALIGN[props.verticalAlign]]: props.verticalAlign },
  ]);

  const renderCell = (params: BaseTableCellParams<TableRowData>) => {
    const { col, row } = params;
    if (isFunction(col.cell)) {
      return col.cell(h, params);
    }
    if (slots[col.colKey]) {
      return slots[col.colKey](params);
    }
    if (isString(col.cell) && slots[col.cell]) {
      return slots[col.cell](params);
    }
    if (isFunction(col.render)) {
      return col.render(h, { ...params, type: 'cell' });
    }
    return get(row, col.colKey);
  };

  const renderEllipsisCell = (cellParams: BaseTableCellParams<TableRowData>, params: RenderEllipsisCellParams) => {
    const { columnLength, cellNode } = params;
    const { col, colIndex } = cellParams;
    // 最后一个元素，底部有对齐，避免信息右侧超出父元素
    const placement = colIndex === columnLength - 1 ? 'bottom-right' : 'bottom-left';
    const content = isFunction(col.ellipsis) ? col.ellipsis(h, cellParams) : undefined;

    return (
      <TEllipsis
        placement={placement}
        popupContent={content && (() => content)}
        popupProps={typeof col.ellipsis === 'object' ? col.ellipsis : undefined}
      >
        {cellNode}
      </TEllipsis>
    );
  };

  const getFullRow = (
    columnLength: number,
    fullRow: TdBaseTableProps['firstFullRow'],
    type: 'first-full-row' | 'last-full-row',
  ) => {
    if (!fullRow) return null;
    const fullRowNode = useTNodeJSX(camelCase(type), { slots });
    if (['', null, undefined, false].includes(fullRowNode)) return null;
    const classes = [`${prefix}-table__row--full`, `${prefix}-table__row-${type}`];
    return (
      <tr class={classes}>
        <td colspan={columnLength}>{fullRowNode}</td>
      </tr>
    );
  };

  const renderEmpty = (columns: RenderTableBodyParams['columns']) => (
    <tr class={TABLE_CLASS_EMPTY_ROW}>
      <td colspan={columns.length}>
        <div class={TABLE_CLASS_EMPTY}>{useTNodeJSX('empty', { slots, defaultNode: '暂无数据' })}</div>
      </td>
    </tr>
  );

  const setSkippedCell = (
    skipSpansMap: Map<any, boolean>,
    { rowIndex, colIndex }: BaseTableCellParams<TableRowData>,
    cellSpans: RowspanColspan,
  ) => {
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

  const renderTd = (params: BaseTableCellParams<TableRowData>, extra: RenderTdExtra) => {
    const { col, colIndex, rowIndex } = params;
    const { columnLength, cellSpans, dataLength } = extra;
    const cellNode = renderCell(params);
    const tdStyles = getColumnFixedStyles(col, colIndex, extra.columnStickyLeftAndRight, columnLength);
    const customClasses = isFunction(col.className) ? col.className({ ...params, type: 'td' }) : col.className;
    const classes = [
      tdStyles.classes,
      customClasses,
      {
        [TABLE_TD_ELLIPSIS_CLASS]: col.ellipsis,
        [TABLE_TD_LAST_ROW]: rowIndex + cellSpans.rowspan === dataLength,
      },
    ];
    // const attrs: { [key: string]: any } = col.attrs ? col.attrs : {};
    const onClick = (e: MouseEvent) => {
      const p = { ...params, e };
      props.onCellClick?.(p);
      // Vue3 ignore this line
      emit('cell-click', p);
    };
    return (
      <td class={classes} style={tdStyles.style} attrs={{ ...col.attrs, ...cellSpans }} onClick={onClick}>
        {col.ellipsis ? renderEllipsisCell(params, { cellNode, columnLength }) : cellNode}
      </td>
    );
  };

  const getTrListeners = (row: TableRowData, rowIndex: number) => {
    const trListeners: { [eventName: string]: (e: MouseEvent) => void } = {};
    // add events to row
    Object.keys(ROW_LISTENERS).forEach((eventName) => {
      trListeners[eventName] = (e: MouseEvent) => {
        const p = { e, row, index: rowIndex };
        props[`onRow${upperFirst(eventName)}`]?.(p);
        props.onRowClick?.(p);
        // Vue3 ignore this line
        emit(`row-${eventName}`, p);
      };
    });
    return trListeners;
  };

  const renderTableBody = (p: RenderTableBodyParams) => {
    const { columnStickyLeftAndRight, data, columns } = p;
    const columnLength = columns.length;
    const trNodeList: JSX.Element[] = [];
    // 受合并单元格影响，部分单元格不显示
    const skipSpansMap = new Map<any, boolean>();
    const dataLength = data.length;
    data?.forEach((row, rowIndex) => {
      const trStyles = getRowFixedStyles(rowIndex, columnStickyLeftAndRight, data.length, props.fixedRows);
      const trAttributes = isFunction(props.rowAttributes)
        ? props.rowAttributes({ row, rowIndex, type: 'body' })
        : props.rowAttributes;
      // 自定义行类名
      let customClasses = isFunction(props.rowClassName)
        ? props.rowClassName({ row, rowIndex, type: 'body' })
        : props.rowClassName;
      // { 1: 't-row-custom-class-name' } 设置第 2 行的类名为 t-row-custom-class-name
      if (typeof customClasses === 'object' && customClasses[rowIndex]) {
        customClasses = customClasses[rowIndex];
      }
      const classes = [trStyles.classes, customClasses];
      const trNode = (
        <tr on={getTrListeners(row, rowIndex)} attrs={trAttributes} style={trStyles.style} class={classes}>
          {columns.map((col, colIndex) => {
            const cellSpans: RowspanColspan = {};
            if (isFunction(props.rowspanAndColspan)) {
              const o = props.rowspanAndColspan({
                row,
                col,
                rowIndex,
                colIndex,
              });
              o?.rowspan > 1 && (cellSpans.rowspan = o.rowspan);
              o?.colspan > 1 && (cellSpans.colspan = o.colspan);
            }
            const skipped = skipSpansMap.get([rowIndex, colIndex].join());
            if (skipped) return null;
            const params = {
              row,
              col,
              rowIndex,
              colIndex,
            };
            setSkippedCell(skipSpansMap, params, cellSpans);
            return renderTd(params, {
              dataLength,
              columnStickyLeftAndRight,
              columnLength,
              cellSpans,
            });
          })}
        </tr>
      );
      trNodeList.push(trNode);
      // 执行展开行渲染
      if (props.renderExpandedRow) {
        trNodeList.push(props.renderExpandedRow({ row, index: rowIndex }));
      }
    });

    const list = [
      getFullRow(columnLength, props.firstFullRow, 'first-full-row'),
      trNodeList,
      getFullRow(columnLength, props.lastFullRow, 'last-full-row'),
    ];
    const isEmpty = !data?.length && !props.loading;
    return <tbody class={tbodyClases.value}>{isEmpty ? renderEmpty(columns) : list}</tbody>;
  };

  return {
    renderCell,
    renderTableBody,
  };
}
