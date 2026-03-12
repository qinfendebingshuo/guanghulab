export declare const apiName = "internal.util.getBindSmartDeviceOrgList";
/**
 * 获取绑定了智能设备的企业列表 请求参数定义
 * @apiName internal.util.getBindSmartDeviceOrgList
 */
export interface IInternalUtilGetBindSmartDeviceOrgListParams {
    [key: string]: any;
}
/**
 * 获取绑定了智能设备的企业列表 返回结果定义
 * @apiName internal.util.getBindSmartDeviceOrgList
 */
export interface IInternalUtilGetBindSmartDeviceOrgListResult {
    [key: string]: any;
}
/**
 * 获取绑定了智能设备的企业列表
 * @apiName internal.util.getBindSmartDeviceOrgList
 * @supportVersion  ios: 4.0 android: 4.0
 */
export declare function getBindSmartDeviceOrgList$(params: IInternalUtilGetBindSmartDeviceOrgListParams): Promise<IInternalUtilGetBindSmartDeviceOrgListResult>;
export default getBindSmartDeviceOrgList$;
