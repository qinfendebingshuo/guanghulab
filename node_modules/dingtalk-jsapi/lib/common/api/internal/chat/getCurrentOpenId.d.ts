export declare const apiName = "internal.chat.getCurrentOpenId";
/**
 * 获取当前登陆用户的openId 请求参数定义
 * @apiName internal.chat.getCurrentOpenId
 */
export interface IInternalChatGetCurrentOpenIdParams {
}
/**
 * 获取当前登陆用户的openId 返回结果定义
 * @apiName internal.chat.getCurrentOpenId
 */
export interface IInternalChatGetCurrentOpenIdResult {
    openId: number;
}
/**
 * 获取当前登陆用户的openId
 * @apiName internal.chat.getCurrentOpenId
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getCurrentOpenId$(params: IInternalChatGetCurrentOpenIdParams): Promise<IInternalChatGetCurrentOpenIdResult>;
export default getCurrentOpenId$;
