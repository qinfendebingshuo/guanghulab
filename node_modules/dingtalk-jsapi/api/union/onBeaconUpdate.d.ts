import { ICommonAPIParams } from '../../constant/types';
/**
 * 监听 iBeacon 设备的更新事件。 请求参数定义
 * @apiName onBeaconUpdate
 */
export interface IUnionOnBeaconUpdateParams extends ICommonAPIParams {
}
/**
 * 监听 iBeacon 设备的更新事件。 返回结果定义
 * @apiName onBeaconUpdate
 */
export interface IUnionOnBeaconUpdateResult {
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
 * 监听 iBeacon 设备的更新事件。。
 * @apiName onBeaconUpdate
 * @supportVersion  ios: 4.6.38 android: 4.6.38
 */
export declare function onBeaconUpdate$(params: IUnionOnBeaconUpdateParams): void;
export default onBeaconUpdate$;
