import { ICommonAPIParams } from '../../constant/types';
/**
 * 月历组件：选择半天 请求参数定义
 * @apiName chooseHalfDayInCalendar
 */
export interface IUnionChooseHalfDayInCalendarParams extends ICommonAPIParams {
    default: number;
}
/**
 * 月历组件：选择半天 返回结果定义
 * @apiName chooseHalfDayInCalendar
 */
export interface IUnionChooseHalfDayInCalendarResult {
    chosen: number;
    timezone: number;
}
/**
 * 月历组件：选择半天
 * @apiName chooseHalfDayInCalendar
 */
export declare function chooseHalfDayInCalendar$(params: IUnionChooseHalfDayInCalendarParams): Promise<IUnionChooseHalfDayInCalendarResult>;
export default chooseHalfDayInCalendar$;
