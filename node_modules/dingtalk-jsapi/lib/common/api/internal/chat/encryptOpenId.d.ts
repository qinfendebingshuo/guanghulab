export declare const apiName = "internal.chat.encryptOpenId";
/**
 * 把普通的uid转换成加密的uid 请求参数定义
 * @apiName internal.chat.encryptOpenId
 */
export interface IInternalChatEncryptOpenIdParams {
    openId: number;
}
/**
 * 把普通的uid转换成加密的uid 返回结果定义
 * @apiName internal.chat.encryptOpenId
 */
export interface IInternalChatEncryptOpenIdResult {
    encryptOpenId: any;
}
/**
 * 把普通的uid转换成加密的uid
 * @apiName internal.chat.encryptOpenId
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function encryptOpenId$(params: IInternalChatEncryptOpenIdParams): Promise<IInternalChatEncryptOpenIdResult>;
export default encryptOpenId$;
