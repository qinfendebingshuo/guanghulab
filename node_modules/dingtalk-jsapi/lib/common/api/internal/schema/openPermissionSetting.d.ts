export declare const apiName = "internal.schema.openPermissionSetting";
/**
 * 打开钉钉权限设置页面 请求参数定义
 * @apiName internal.schema.openPermissionSetting
 */
export interface IInternalSchemaOpenPermissionSettingParams {
}
/**
 * 打开钉钉权限设置页面 返回结果定义
 * @apiName internal.schema.openPermissionSetting
 */
export interface IInternalSchemaOpenPermissionSettingResult {
}
/**
 * 打开钉钉权限设置页面
 * @apiName internal.schema.openPermissionSetting
 * @supportVersion android: 4.6.11
 */
export declare function openPermissionSetting$(params: IInternalSchemaOpenPermissionSettingParams): Promise<IInternalSchemaOpenPermissionSettingResult>;
export default openPermissionSetting$;
