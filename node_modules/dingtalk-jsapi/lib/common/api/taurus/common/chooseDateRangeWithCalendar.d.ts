export declare const apiName = "taurus.common.chooseDateRangeWithCalendar";
/**
 * 使用月历控件选择日期范围 请求参数定义
 * @apiName taurus.common.chooseDateRangeWithCalendar
 */
export interface ITaurusCommonChooseDateRangeWithCalendarParams {
    defaultStart?: number;
    defaultEnd?: number;
}
/**
 * 使用月历控件选择日期范围 返回结果定义
 * @apiName taurus.common.chooseDateRangeWithCalendar
 */
export interface ITaurusCommonChooseDateRangeWithCalendarResult {
    start: number;
    end: number;
    timezone: number;
}
/**
 * 使用月历控件选择日期范围
 * @apiName taurus.common.chooseDateRangeWithCalendar
 * @supportVersion ios: 1.3.10 android: 1.3.10
 */
export declare function chooseDateRangeWithCalendar$(params: ITaurusCommonChooseDateRangeWithCalendarParams): Promise<ITaurusCommonChooseDateRangeWithCalendarResult>;
export default chooseDateRangeWithCalendar$;
