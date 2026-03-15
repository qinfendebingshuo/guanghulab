export declare const apiName = "internal.blebusiness.queryDingWifiDevicesWithOrg";
/**
 * 查询DING网络设备列表（带企业关系） 请求参数定义
 * @apiName internal.blebusiness.queryDingWifiDevicesWithOrg
 */
export interface IInternalBlebusinessQueryDingWifiDevicesWithOrgParams {
    /** 设备小类型 */
    devServId: number;
    /** 设备序列号  */
    sn?: string;
    /** Mac地址 */
    mac?: string;
}
/**
 * 查询DING网络设备列表（带企业关系） 返回结果定义
 * @apiName internal.blebusiness.queryDingWifiDevicesWithOrg
 */
export interface IInternalBlebusinessQueryDingWifiDevicesWithOrgResult {
    /** DTAlphaDeviceModel数组的JSON字符串 */
    devices: string;
}
/**
 * 查询DING网络设备列表（带企业关系）
 * @apiName internal.blebusiness.queryDingWifiDevicesWithOrg
 * @supportVersion ios: 4.6.18
 */
export declare function queryDingWifiDevicesWithOrg$(params: IInternalBlebusinessQueryDingWifiDevicesWithOrgParams): Promise<IInternalBlebusinessQueryDingWifiDevicesWithOrgResult>;
export default queryDingWifiDevicesWithOrg$;
