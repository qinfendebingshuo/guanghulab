export declare const apiName = "internal.user.isNewUser";
/**
 * 是否是新用户 请求参数定义
 * @apiName internal.user.isNewUser
 */
export interface IInternalUserIsNewUserParams {
    [key: string]: any;
}
/**
 * 是否是新用户 返回结果定义
 * @apiName internal.user.isNewUser
 */
export interface IInternalUserIsNewUserResult {
    [key: string]: any;
}
/**
 * 是否是新用户
 * @apiName internal.user.isNewUser
 * @supportVersion  ios: 3.4.0 android: 3.4.0
 */
export declare function isNewUser$(params: IInternalUserIsNewUserParams): Promise<IInternalUserIsNewUserResult>;
export default isNewUser$;
