export declare const apiName = "internal.chat.getDisplayName";
/**
 * 根据openId和conversationId获取对应的显示名 请求参数定义
 * @apiName internal.chat.getDisplayName
 */
export interface IInternalChatGetDisplayNameParams {
    openId: number;
    conversationId: string;
}
/**
 * 根据openId和conversationId获取对应的显示名 返回结果定义
 * @apiName internal.chat.getDisplayName
 */
export interface IInternalChatGetDisplayNameResult {
    displayName: string;
}
/**
 * 根据openId和conversationId获取对应的显示名
 * @apiName internal.chat.getDisplayName
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function getDisplayName$(params: IInternalChatGetDisplayNameParams): Promise<IInternalChatGetDisplayNameResult>;
export default getDisplayName$;
