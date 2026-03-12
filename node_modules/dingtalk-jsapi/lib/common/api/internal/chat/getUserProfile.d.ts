export declare const apiName = "internal.chat.getUserProfile";
/**
 * 根据openId获取对应的profile 请求参数定义
 * @apiName internal.chat.getUserProfile
 */
export interface IInternalChatGetUserProfileParams {
    openId: number;
}
/**
 * 根据openId获取对应的profile 返回结果定义
 * @apiName internal.chat.getUserProfile
 */
export interface IInternalChatGetUserProfileResult {
    userProfile: any;
}
/**
 * 根据openId获取对应的profile
 * @apiName internal.chat.getUserProfile
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getUserProfile$(params: IInternalChatGetUserProfileParams): Promise<IInternalChatGetUserProfileResult>;
export default getUserProfile$;
