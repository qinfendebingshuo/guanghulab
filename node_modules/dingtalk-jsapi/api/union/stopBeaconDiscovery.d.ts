import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止搜索附近的 iBeacon 设备 请求参数定义
 * @apiName stopBeaconDiscovery
 */
export interface IUnionStopBeaconDiscoveryParams extends ICommonAPIParams {
}
/**
 * 停止搜索附近的 iBeacon 设备 返回结果定义
 * @apiName stopBeaconDiscovery
 */
export interface IUnionStopBeaconDiscoveryResult {
    [key: string]: any;
}
/**
 * 停止搜索附近的 iBeacon 设备。
 * @apiName stopBeaconDiscovery
 * @supportVersion  ios: 4.6.38 android: 4.6.38
 */
export declare function stopBeaconDiscovery$(params: IUnionStopBeaconDiscoveryParams): Promise<IUnionStopBeaconDiscoveryResult>;
export default stopBeaconDiscovery$;
