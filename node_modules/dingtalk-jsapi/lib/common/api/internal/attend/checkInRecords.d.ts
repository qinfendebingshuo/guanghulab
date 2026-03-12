export declare const apiName = "internal.attend.checkInRecords";
/**
 * 供内部页面使用，查询本地极速打卡流水记录 请求参数定义
 * @apiName internal.attend.checkInRecords
 */
export interface IInternalAttendCheckInRecordsParams {
    [key: string]: any;
}
/**
 * 供内部页面使用，查询本地极速打卡流水记录 返回结果定义
 * @apiName internal.attend.checkInRecords
 */
export interface IInternalAttendCheckInRecordsResult {
    [key: string]: any;
}
/**
 * 供内部页面使用，查询本地极速打卡流水记录
 * @apiName internal.attend.checkInRecords
 * @supportVersion  ios: 4.2.8 android: 4.2.8
 */
export declare function checkInRecords$(params: IInternalAttendCheckInRecordsParams): Promise<IInternalAttendCheckInRecordsResult>;
export default checkInRecords$;
