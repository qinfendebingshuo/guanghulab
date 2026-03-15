export declare const apiName = "internal.schema.openWifiSetting";
/**
 * 跳转到wifi设置（Android） 请求参数定义
 * @apiName internal.schema.openWifiSetting
 */
export interface IInternalSchemaOpenWifiSettingParams {
    [key: string]: any;
}
/**
 * 跳转到wifi设置（Android） 返回结果定义
 * @apiName internal.schema.openWifiSetting
 */
export interface IInternalSchemaOpenWifiSettingResult {
    [key: string]: any;
}
/**
 * 跳转到wifi设置（Android）
 * @apiName internal.schema.openWifiSetting
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function openWifiSetting$(params: IInternalSchemaOpenWifiSettingParams): Promise<IInternalSchemaOpenWifiSettingResult>;
export default openWifiSetting$;
