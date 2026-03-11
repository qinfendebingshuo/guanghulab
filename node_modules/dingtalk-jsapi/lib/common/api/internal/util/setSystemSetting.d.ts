export declare const apiName = "internal.util.setSystemSetting";
/**
 * 设置系统设置值 请求参数定义
 * @apiName internal.util.setSystemSetting
 */
export interface IInternalUtilSetSystemSettingParams {
    /** 设置项Id */
    item: string;
    /** 设置项值 */
    value: string;
}
/**
 * 设置系统设置值 返回结果定义 result: boolean: 是否设置成功
 * @apiName internal.util.setSystemSetting
 */
export interface IInternalUtilSetSystemSettingResult {
    [key: string]: any;
}
/**
 * 设置系统设置值
 * @apiName internal.util.setSystemSetting
 * @supportVersion Win: 6.0.19  Mac: 6.0.19
 * @author Win：周镛, MAC：奔云
 */
export declare function setSystemSetting$(params: IInternalUtilSetSystemSettingParams): Promise<IInternalUtilSetSystemSettingResult>;
export default setSystemSetting$;
