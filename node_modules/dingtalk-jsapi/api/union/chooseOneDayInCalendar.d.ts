import { ICommonAPIParams } from '../../constant/types';
/**
 * 月历组件：选择某天 请求参数定义
 * @apiName chooseOneDayInCalendar
 */
export interface IUnionChooseOneDayInCalendarParams extends ICommonAPIParams {
    default: number;
}
/**
 * 月历组件：选择某天 返回结果定义
 * @apiName chooseOneDayInCalendar
 */
export interface IUnionChooseOneDayInCalendarResult {
    chosen: number;
    timezone: number;
}
/**
 * 月历组件：选择某天
 * @apiName chooseOneDayInCalendar
 */
export declare function chooseOneDayInCalendar$(params: IUnionChooseOneDayInCalendarParams): Promise<IUnionChooseOneDayInCalendarResult>;
export default chooseOneDayInCalendar$;
