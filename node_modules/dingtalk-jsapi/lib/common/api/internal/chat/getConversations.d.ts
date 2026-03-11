export declare const apiName = "internal.chat.getConversations";
/**
 * 获取会话的详细信息 请求参数定义
 * @apiName internal.chat.getConversations
 */
export interface IInternalChatGetConversationsParams {
    cids: string[];
}
/**
 * 获取会话的详细信息 返回结果定义
 * @apiName internal.chat.getConversations
 */
export declare type IInternalChatGetConversationsResult = any[];
/**
 * 获取会话的详细信息
 * @apiName internal.chat.getConversations
 * @supportVersion ios: 5.1.26 android: 5.1.26
 * @author Android：辰煦 iOS：世离
 */
export declare function getConversations$(params: IInternalChatGetConversationsParams): Promise<IInternalChatGetConversationsResult>;
export default getConversations$;
