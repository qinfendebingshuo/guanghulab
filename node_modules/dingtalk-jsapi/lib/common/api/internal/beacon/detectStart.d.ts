export declare const apiName = "internal.beacon.detectStart";
/**
 * detectStart 请求参数定义
 * @apiName internal.beacon.detectStart
 */
export interface IInternalBeaconDetectStartParams {
    [key: string]: any;
}
/**
 * detectStart 返回结果定义
 * @apiName internal.beacon.detectStart
 */
export interface IInternalBeaconDetectStartResult {
    [key: string]: any;
}
/**
 * detectStart
 * @apiName internal.beacon.detectStart
 * @supportVersion  ios: 3.1.0 android: 3.1.0
 */
export declare function detectStart$(params: IInternalBeaconDetectStartParams): Promise<IInternalBeaconDetectStartResult>;
export default detectStart$;
