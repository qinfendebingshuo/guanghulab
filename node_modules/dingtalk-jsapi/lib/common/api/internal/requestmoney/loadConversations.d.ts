export declare const apiName = "internal.requestmoney.loadConversations";
/**
 * 批量获取会话的头像和名称 请求参数定义
 * @apiName internal.requestmoney.loadConversations
 */
export interface IInternalRequestmoneyLoadConversationsParams {
    /** 会话id数组 */
    cIds: string[];
}
/**
 * 批量获取会话的头像和名称 返回结果定义
 * @apiName internal.requestmoney.loadConversations
 */
export interface IInternalRequestmoneyLoadConversationsResult {
    conversations: Array<{
        cId: string;
        title: string;
        icon: string;
    }>;
}
/**
 * 批量获取会话的头像和名称
 * @apiName internal.requestmoney.loadConversations
 * @supportVersion ios: 4.5.8 android: 4.5.8
 */
export declare function loadConversations$(params: IInternalRequestmoneyLoadConversationsParams): Promise<IInternalRequestmoneyLoadConversationsResult>;
export default loadConversations$;
