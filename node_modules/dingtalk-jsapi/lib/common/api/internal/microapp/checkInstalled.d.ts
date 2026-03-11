export declare const apiName = "internal.microapp.checkInstalled";
/**
 * 检测微应用是否安装 请求参数定义
 * @apiName internal.microapp.checkInstalled
 */
export interface IInternalMicroappCheckInstalledParams {
    [key: string]: any;
}
/**
 * 检测微应用是否安装 返回结果定义
 * @apiName internal.microapp.checkInstalled
 */
export interface IInternalMicroappCheckInstalledResult {
    [key: string]: any;
}
/**
 * 检测微应用是否安装
 * @apiName internal.microapp.checkInstalled
 * @supportVersion  ios: 2.5.0 android: 2.5.0
 */
export declare function checkInstalled$(params: IInternalMicroappCheckInstalledParams): Promise<IInternalMicroappCheckInstalledResult>;
export default checkInstalled$;
