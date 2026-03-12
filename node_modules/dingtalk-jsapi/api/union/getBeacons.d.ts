import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取已经搜索到的 iBeacon 设备 请求参数定义
 * @apiName getBeacons
 */
export interface IUnionGetBeaconsParams extends ICommonAPIParams {
}
/**
 * 获取已经搜索到的 iBeacon 设备 返回结果定义
 * @apiName getBeacons
 */
export interface IUnionGetBeaconsResult {
    beacons: {
        uuid: string;
        major: string;
        minor: string;
        proximity: number;
        accuracy: number;
        rssi: number;
    }[];
}
/**
 * 获取已经搜索到的 iBeacon 设备。
 * @apiName getBeacons
 * @supportVersion  ios: 4.6.38 android: 4.6.38
 */
export declare function getBeacons$(params: IUnionGetBeaconsParams): Promise<IUnionGetBeaconsResult>;
export default getBeacons$;
