import { ICommonAPIParams } from '../../constant/types';
/**
 * 月历组件：选择日期区间 请求参数定义
 * @apiName dateRangePicker
 */
export interface IUnionDateRangePickerParams extends ICommonAPIParams {
    defaultEnd: number;
    defaultStart?: number;
}
/**
 * 月历组件：选择日期区间 返回结果定义
 * @apiName dateRangePicker
 */
export interface IUnionDateRangePickerResult {
    end: number;
    start: number;
    timezone: number;
}
/**
 * 月历组件：选择日期区间
 * @apiName dateRangePicker
 */
export declare function dateRangePicker$(params: IUnionDateRangePickerParams): Promise<IUnionDateRangePickerResult>;
export default dateRangePicker$;
