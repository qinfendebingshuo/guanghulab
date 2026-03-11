export declare const apiName = "internal.blebusiness.getDeviceInfo";
/**
 * 读取App端缓存的设备信息（如有必要再向服务端查询） 请求参数定义
 * @apiName internal.blebusiness.getDeviceInfo
 */
export interface IInternalBlebusinessGetDeviceInfoParams {
    /** （设备ID） */
    devId: string;
    /** 设备大类型 */
    devType: string;
    /** 设备小类型 */
    devServId: string;
}
/**
 * 读取App端缓存的设备信息（如有必要再向服务端查询） 返回结果定义
 * @apiName internal.blebusiness.getDeviceInfo
 */
export interface IInternalBlebusinessGetDeviceInfoResult {
    /** DTBizDeviceModel的JSON字符串 */
    deviceModel: string;
}
/**
 * 读取App端缓存的设备信息（如有必要再向服务端查询）
 * @apiName internal.blebusiness.getDeviceInfo
 * @supportVersion ios: 4.6.18
 */
export declare function getDeviceInfo$(params: IInternalBlebusinessGetDeviceInfoParams): Promise<IInternalBlebusinessGetDeviceInfoResult>;
export default getDeviceInfo$;
