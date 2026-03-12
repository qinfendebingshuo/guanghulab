export declare const apiName = "internal.permission.hasSelfPermissions";
/**
 * 查询Android系统权限 请求参数定义
 * @apiName internal.permission.hasSelfPermissions
 */
export interface IInternalPermissionHasSelfPermissionsParams {
    /**  string数组，权限列表，必要 */
    permissions: string[];
}
/**
 * 查询Android系统权限 返回结果定义
 * @apiName internal.permission.hasSelfPermissions
 */
export interface IInternalPermissionHasSelfPermissionsResult {
    [key: string]: any;
}
/**
 * 查询Android系统权限
 * @apiName internal.permission.hasSelfPermissions
 * @supportVersion ios: 4.5.0 android: 4.5.0
 */
export declare function hasSelfPermissions$(params: IInternalPermissionHasSelfPermissionsParams): Promise<IInternalPermissionHasSelfPermissionsResult>;
export default hasSelfPermissions$;
