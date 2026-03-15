export declare const apiName = "internal.util.getSystemSetting";
/**
 * 获取系统设置值 请求参数定义
 * @apiName internal.util.getSystemSetting
 */
export interface IInternalUtilGetSystemSettingParams {
    /** 设置项Id */
    item: string;
}
/**
 * 获取系统设置值 返回结果定义
 * @apiName internal.util.getSystemSetting
 */
export interface IInternalUtilGetSystemSettingResult {
    /** 设置项id对应的值 */
    value: string;
}
/**
 * 获取系统设置值
 * @apiName internal.util.getSystemSetting
 * @supportVersion Win: 6.0.19  Mac: 6.0.19
 * @author Win：周镛, MAC：奔云
 */
export declare function getSystemSetting$(params: IInternalUtilGetSystemSettingParams): Promise<IInternalUtilGetSystemSettingResult>;
export default getSystemSetting$;
