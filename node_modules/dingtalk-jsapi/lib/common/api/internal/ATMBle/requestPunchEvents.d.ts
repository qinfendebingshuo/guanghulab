export declare const apiName = "internal.ATMBle.requestPunchEvents";
/**
 * 提供全量更新多场景任务的接口 请求参数定义
 * @apiName internal.ATMBle.requestPunchEvents
 */
export interface IInternalATMBleRequestPunchEventsParams {
}
/**
 * 提供全量更新多场景任务的接口 返回结果定义
 * @apiName internal.ATMBle.requestPunchEvents
 */
export interface IInternalATMBleRequestPunchEventsResult {
    /** 有返回值即为接口调用成功。 */
    result: boolean;
}
/**
 * 提供全量更新多场景任务的接口
 * @apiName internal.ATMBle.requestPunchEvents
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author Android:序望，iOS：度尽
 */
export declare function requestPunchEvents$(params: IInternalATMBleRequestPunchEventsParams): Promise<IInternalATMBleRequestPunchEventsResult>;
export default requestPunchEvents$;
