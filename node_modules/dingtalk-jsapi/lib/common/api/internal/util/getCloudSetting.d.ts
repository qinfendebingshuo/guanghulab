export declare const apiName = "internal.util.getCloudSetting";
/**
 * 获取 cloud setting 的值 请求参数定义
 * @apiName internal.util.getCloudSetting
 */
export interface IInternalUtilGetCloudSettingParams {
    /** module 名称 */
    module: string;
    /** key 名称 */
    key: string;
}
/**
 * 获取 cloud setting 的值 返回结果定义
 * @apiName internal.util.getCloudSetting
 */
export interface IInternalUtilGetCloudSettingResult {
    settingValue: string;
}
/**
 * 获取 cloud setting 的值
 * @apiName internal.util.getCloudSetting
 * @supportVersion ios: 4.6.12 android: 4.6.12
 */
export declare function getCloudSetting$(params: IInternalUtilGetCloudSettingParams): Promise<IInternalUtilGetCloudSettingResult>;
export default getCloudSetting$;
