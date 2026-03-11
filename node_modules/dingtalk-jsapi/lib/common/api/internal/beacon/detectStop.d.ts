export declare const apiName = "internal.beacon.detectStop";
/**
 * detectStop 请求参数定义
 * @apiName internal.beacon.detectStop
 */
export interface IInternalBeaconDetectStopParams {
    [key: string]: any;
}
/**
 * detectStop 返回结果定义
 * @apiName internal.beacon.detectStop
 */
export interface IInternalBeaconDetectStopResult {
    [key: string]: any;
}
/**
 * detectStop
 * @apiName internal.beacon.detectStop
 * @supportVersion  ios: 3.1.0 android: 3.1.0
 */
export declare function detectStop$(params: IInternalBeaconDetectStopParams): Promise<IInternalBeaconDetectStopResult>;
export default detectStop$;
