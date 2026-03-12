export declare const apiName = "internal.beacon.detectBeacons";
/**
 * beacon 请求参数定义
 * @apiName internal.beacon.detectBeacons
 */
export interface IInternalBeaconDetectBeaconsParams {
    [key: string]: any;
}
/**
 * beacon 返回结果定义
 * @apiName internal.beacon.detectBeacons
 */
export interface IInternalBeaconDetectBeaconsResult {
    [key: string]: any;
}
/**
 * beacon
 * @apiName internal.beacon.detectBeacons
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function detectBeacons$(params: IInternalBeaconDetectBeaconsParams): Promise<IInternalBeaconDetectBeaconsResult>;
export default detectBeacons$;
