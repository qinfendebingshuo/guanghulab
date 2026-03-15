export declare const apiName = "runtime.permission.requestJsApis";
/**
 * 权限校验jsapi，隐藏方法，只限sdk内部调用 请求参数定义
 * @apiName runtime.permission.requestJsApis
 */
export interface IRuntimePermissionRequestJsApisParams {
    [key: string]: any;
}
/**
 * 权限校验jsapi，隐藏方法，只限sdk内部调用 返回结果定义
 * @apiName runtime.permission.requestJsApis
 */
export interface IRuntimePermissionRequestJsApisResult {
    [key: string]: any;
}
/**
 * 权限校验jsapi，隐藏方法，只限sdk内部调用
 * @apiName runtime.permission.requestJsApis
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function requestJsApis$(params: IRuntimePermissionRequestJsApisParams): Promise<IRuntimePermissionRequestJsApisResult>;
export default requestJsApis$;
