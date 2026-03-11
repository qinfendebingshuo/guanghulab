import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取热点接入信息 请求参数定义
 * @apiName getWifiHotspotStatus
 */
export interface IUnionGetWifiHotspotStatusParams extends ICommonAPIParams {
}
/**
 * 获取热点接入信息 返回结果定义
 * @apiName getWifiHotspotStatus
 */
export interface IUnionGetWifiHotspotStatusResult {
    ssid: string;
    macIp: string;
}
/**
 * 获取热点接入信息
 * @apiName getWifiHotspotStatus
 */
export declare function getWifiHotspotStatus$(params: IUnionGetWifiHotspotStatusParams): Promise<IUnionGetWifiHotspotStatusResult>;
export default getWifiHotspotStatus$;
