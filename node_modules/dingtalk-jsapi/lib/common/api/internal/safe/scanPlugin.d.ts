export declare const apiName = "internal.safe.scanPlugin";
/**
 * iOS 越狱插件行为扫描 请求参数定义
 * @apiName internal.safe.scanPlugin
 */
export interface IInternalSafeScanPluginParams {
    [key: string]: any;
}
/**
 * iOS 越狱插件行为扫描 返回结果定义
 * @apiName internal.safe.scanPlugin
 */
export interface IInternalSafeScanPluginResult {
    [key: string]: any;
}
/**
 * iOS 越狱插件行为扫描
 * @apiName internal.safe.scanPlugin
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function scanPlugin$(params: IInternalSafeScanPluginParams): Promise<IInternalSafeScanPluginResult>;
export default scanPlugin$;
