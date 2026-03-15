export declare const apiName = "internal.permission.requestPermissions";
/**
 * 查询申请Android系统权限 请求参数定义
 * @apiName internal.permission.requestPermissions
 */
export interface IInternalPermissionRequestPermissionsParams {
    permissions: string[];
}
/**
 * 查询申请Android系统权限 返回结果定义
 * @apiName internal.permission.requestPermissions
 */
export interface IInternalPermissionRequestPermissionsResult {
    [key: string]: any;
}
/**
 * 查询申请Android系统权限
 * @apiName internal.permission.requestPermissions
 * @supportVersion ios: 4.3.9 android: 4.3.9
 */
export declare function requestPermissions$(params: IInternalPermissionRequestPermissionsParams): Promise<IInternalPermissionRequestPermissionsResult>;
export default requestPermissions$;
