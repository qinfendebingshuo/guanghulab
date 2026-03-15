export declare const apiName = "biz.calendar.datePicker";
/**
 * 新的日历控件（包含年月日），4.3.2版本仅支持android 请求参数定义
 * @apiName biz.calendar.datePicker
 */
export interface IBizCalendarDatePickerParams {
    format: string;
    value: string;
}
/**
 * 新的日历控件（包含年月日），4.3.2版本仅支持android 返回结果定义
 * @apiName biz.calendar.datePicker
 */
export interface IBizCalendarDatePickerResult {
    value: string;
}
/**
 * 新的日历控件（包含年月日），4.3.2版本仅支持android
 * @apiName biz.calendar.datePicker
 * @supportVersion ios: 4.3.2 android: 4.3.2
 */
export declare function datePicker$(params: IBizCalendarDatePickerParams): Promise<IBizCalendarDatePickerResult>;
export default datePicker$;
