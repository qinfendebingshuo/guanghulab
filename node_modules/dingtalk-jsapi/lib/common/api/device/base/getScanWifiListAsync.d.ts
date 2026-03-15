export declare const apiName = "device.base.getScanWifiListAsync";
/**
 * 获取WIFI 请求参数定义
 * @apiName device.base.getScanWifiListAsync
 */
export interface IDeviceBaseGetScanWifiListAsyncParams {
    /** 超时时间 int 必选 */
    timeout: number;
    /** 缓存时间 int 必选 */
    cacheTime: number;
}
/**
 * 获取WIFI 返回结果定义
 * @apiName device.base.getScanWifiListAsync
 */
export interface IDeviceBaseGetScanWifiListAsyncResult {
    /** 错误码 int枚举值 必选 取值{ 0：成功 1：json错误 2：系统错误 3：超时 } */
    resultCode: number;
    /** WiFi列表 */
    wifiList?: any[];
    /** 成功或错误信息 */
    resultMessage?: string;
}
/**
 * 获取WIFI
 * @apiName device.base.getScanWifiListAsync
 * @supportVersion  ios: 3.3.0 android: 3.3.0
 */
export declare function getScanWifiListAsync$(params: IDeviceBaseGetScanWifiListAsyncParams): Promise<IDeviceBaseGetScanWifiListAsyncResult>;
export default getScanWifiListAsync$;
