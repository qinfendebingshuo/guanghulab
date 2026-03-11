export declare const apiName = "internal.user.getRole";
/**
 * 获取角色 请求参数定义
 * @apiName internal.user.getRole
 */
export interface IInternalUserGetRoleParams {
    [key: string]: any;
}
/**
 * 获取角色 返回结果定义
 * @apiName internal.user.getRole
 */
export interface IInternalUserGetRoleResult {
    [key: string]: any;
}
/**
 * 获取角色
 * @apiName internal.user.getRole
 * @supportVersion  ios: 2.5.0 android: 2.5.0
 */
export declare function getRole$(params: IInternalUserGetRoleParams): Promise<IInternalUserGetRoleResult>;
export default getRole$;
