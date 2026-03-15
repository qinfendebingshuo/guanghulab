export declare const apiName = "biz.util.addCalendarEvent";
/**
 * 添加日历事件到默认日历 请求参数定义
 * @apiName biz.util.addCalendarEvent
 */
export interface IBizUtilAddCalendarEventParams {
    /** 日历事件标题 */
    title?: string;
    /** 事件开始时间戳，单位为毫秒。 */
    beginTime: number;
    /** 事件结束时间，单位为毫秒。如果缺失。默认为开始时间后1小时。如果小于开始时间，则强制设为开始时间 */
    endTime?: number;
    /** 事件详细信息 */
    content?: string;
}
/**
 * 添加日历事件到默认日历 返回结果定义
 * @apiName biz.util.addCalendarEvent
 */
export interface IBizUtilAddCalendarEventResult {
}
/**
 * 添加日历事件到默认日历
 * @apiName biz.util.addCalendarEvent
 * @supportVersion ios: 5.1.37 android: 5.1.37
 * @author Android: 步定, iOS: 照磊
 */
export declare function addCalendarEvent$(params: IBizUtilAddCalendarEventParams): Promise<IBizUtilAddCalendarEventResult>;
export default addCalendarEvent$;
