export declare const apiName = "device.base.getScanWifiList";
/**
 * 获取wifi列表 请求参数定义
 * @apiName device.base.getScanWifiList
 */
export interface IDeviceBaseGetScanWifiListParams {
    [key: string]: any;
}
/**
 * 获取wifi列表 返回结果定义
 * @apiName device.base.getScanWifiList
 */
export interface IDeviceBaseGetScanWifiListResult {
    [key: string]: any;
}
/**
 * 获取wifi列表
 * @apiName device.base.getScanWifiList
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function getScanWifiList$(params: IDeviceBaseGetScanWifiListParams): Promise<IDeviceBaseGetScanWifiListResult>;
export default getScanWifiList$;
