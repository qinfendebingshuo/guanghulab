export declare const apiName = "internal.ATMBle.checkIn";
/**
 * 智能考勤机打卡 请求参数定义
 * @apiName internal.ATMBle.checkIn
 */
export interface IInternalATMBleCheckInParams {
    [key: string]: any;
}
/**
 * 智能考勤机打卡 返回结果定义
 * @apiName internal.ATMBle.checkIn
 */
export interface IInternalATMBleCheckInResult {
    [key: string]: any;
}
/**
 * 智能考勤机打卡
 * @apiName internal.ATMBle.checkIn
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function checkIn$(params: IInternalATMBleCheckInParams): Promise<IInternalATMBleCheckInResult>;
export default checkIn$;
