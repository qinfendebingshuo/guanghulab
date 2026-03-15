export declare const apiName = "internal.user.getCurrentUserInfo";
/**
 * 获取当前用户的信息 请求参数定义
 * @apiName internal.user.getCurrentUserInfo
 */
export interface IInternalUserGetCurrentUserInfoParams {
}
/**
 * 获取当前用户的信息 返回结果定义
 * @apiName internal.user.getCurrentUserInfo
 */
export interface IInternalUserGetCurrentUserInfoResult {
    uid: number;
    name: string;
    avatar: string;
}
/**
 * 获取当前用户的信息
 * @apiName internal.user.getCurrentUserInfo
 * @supportVersion ios: 4.6.13 android: 4.6.13 pc: 6.0.12
 * @supportVersion pc: 法真
 */
export declare function getCurrentUserInfo$(params: IInternalUserGetCurrentUserInfoParams): Promise<IInternalUserGetCurrentUserInfoResult>;
export default getCurrentUserInfo$;
