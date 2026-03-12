import { ICommonAPIParams } from '../../constant/types';
/**
 * 开始搜索附近的 iBeacon 设备 请求参数定义
 * @apiName startBeaconDiscovery
 */
export interface IUnionStartBeaconDiscoveryParams extends ICommonAPIParams {
    uuids: string[];
}
/**
 * 开始搜索附近的 iBeacon 设备 返回结果定义
 * @apiName startBeaconDiscovery
 */
export interface IUnionStartBeaconDiscoveryResult {
}
/**
 * 开始搜索附近的 iBeacon 设备。
 * @apiName startBeaconDiscovery
 * @supportVersion  ios: 4.6.38 android: 4.6.38
 */
export declare function startBeaconDiscovery$(params: IUnionStartBeaconDiscoveryParams): Promise<IUnionStartBeaconDiscoveryResult>;
export default startBeaconDiscovery$;
