import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听 iBeacon 服务的状态变化。 请求参数定义
 * @apiName onBeaconServiceChange
 */
export interface IUnionOnBeaconServiceChangeParams extends ICommonAPIParams {
}
/**
 * 监听 iBeacon 服务的状态变化。 返回结果定义
 * @apiName onBeaconServiceChange
 */
export interface IUnionOnBeaconServiceChangeResult {
    available: boolean;
    discovering: boolean;
}
/**
 * 监听 iBeacon 服务的状态变化。
 * @apiName onBeaconServiceChange
 * @supportVersion  ios: 4.6.38 android: 4.6.38
 */
export declare function onBeaconServiceChange$(params: IUnionOnBeaconServiceChangeParams): void;
export default onBeaconServiceChange$;
