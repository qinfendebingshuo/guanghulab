export declare const apiName = "internal.user.uids2UserInfos";
/**
 * uid列表批量换取用户信息 请求参数定义
 * @apiName internal.user.uids2UserInfos
 */
export interface IInternalUserUids2UserInfosParams {
    uids: number[];
}
/**
 * uid列表批量换取用户信息 返回结果定义
 * @apiName internal.user.uids2UserInfos
 */
export declare type IInternalUserUids2UserInfosResult = Array<{
    uid: number;
    name: number;
    avatar: string;
}>;
/**
 * uid列表批量换取用户信息
 * @apiName internal.user.uids2UserInfos
 * @supportVersion ios: 4.6.13 android: 4.6.13
 */
export declare function uids2UserInfos$(params: IInternalUserUids2UserInfosParams): Promise<IInternalUserUids2UserInfosResult>;
export default uids2UserInfos$;
