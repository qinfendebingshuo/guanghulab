export declare const apiName = "internal.health.queryHealthPermission";
/**
 * 本地跳转华为健康权限申请页面 请求参数定义
 * @apiName internal.health.queryHealthPermission
 */
export interface IInternalHealthQueryHealthPermissionParams {
}
/**
 * 本地跳转华为健康权限申请页面 返回结果定义
 * @apiName internal.health.queryHealthPermission
 */
export interface IInternalHealthQueryHealthPermissionResult {
}
/**
 * 本地跳转华为健康权限申请页面
 * @apiName internal.health.queryHealthPermission
 * @supportVersion  android: 4.7.27
 * @author android: 南洲
 */
export declare function queryHealthPermission$(params: IInternalHealthQueryHealthPermissionParams): Promise<IInternalHealthQueryHealthPermissionResult>;
export default queryHealthPermission$;
