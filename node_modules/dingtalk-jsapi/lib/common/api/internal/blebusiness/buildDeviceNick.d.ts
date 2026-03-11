export declare const apiName = "internal.blebusiness.buildDeviceNick";
/**
 * 构建设备名称 请求参数定义
 * @apiName internal.blebusiness.buildDeviceNick
 */
export interface IInternalBlebusinessBuildDeviceNickParams {
    /** 设备大类型 */
    devType: number;
    /** 设备小类型 */
    devServId: number;
    /** 设备序列号 */
    sn?: string;
    /** 企业名 */
    orgName?: string;
}
/**
 * 构建设备名称 返回结果定义
 * @apiName internal.blebusiness.buildDeviceNick
 */
export interface IInternalBlebusinessBuildDeviceNickResult {
    /** 设备名 */
    deviceNick: string;
}
/**
 * 构建设备名称
 * @apiName internal.blebusiness.buildDeviceNick
 * @supportVersion ios: 4.6.18
 */
export declare function buildDeviceNick$(params: IInternalBlebusinessBuildDeviceNickParams): Promise<IInternalBlebusinessBuildDeviceNickResult>;
export default buildDeviceNick$;
