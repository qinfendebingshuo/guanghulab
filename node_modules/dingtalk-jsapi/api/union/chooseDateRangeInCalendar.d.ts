import { ICommonAPIParams } from '../../constant/types';
/**
 * 月历组件：选择日期区间 请求参数定义
 * @apiName chooseDateRangeInCalendar
 */
export interface IUnionChooseDateRangeInCalendarParams extends ICommonAPIParams {
    defaultEnd: number;
    defaultStart?: number;
}
/**
 * 月历组件：选择日期区间 返回结果定义
 * @apiName chooseDateRangeInCalendar
 */
export interface IUnionChooseDateRangeInCalendarResult {
    end: number;
    start: number;
    timezone: number;
}
/**
 * 月历组件：选择日期区间
 * @apiName chooseDateRangeInCalendar
 */
export declare function chooseDateRangeInCalendar$(params: IUnionChooseDateRangeInCalendarParams): Promise<IUnionChooseDateRangeInCalendarResult>;
export default chooseDateRangeInCalendar$;
