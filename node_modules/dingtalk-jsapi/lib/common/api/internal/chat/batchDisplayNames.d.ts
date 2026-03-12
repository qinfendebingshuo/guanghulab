export declare const apiName = "internal.chat.batchDisplayNames";
/**
 * 根据openIds和conversationId批量获取对应的显示名 请求参数定义
 * @apiName internal.chat.batchDisplayNames
 */
export interface IInternalChatBatchDisplayNamesParams {
    openIds: number[];
    conversationId: string;
}
/**
 * 根据openIds和conversationId批量获取对应的显示名 返回结果定义
 * @apiName internal.chat.batchDisplayNames
 */
export interface IInternalChatBatchDisplayNamesResult {
    displayNames: any;
}
/**
 * 根据openIds和conversationId批量获取对应的显示名
 * @apiName internal.chat.batchDisplayNames
 * @supportVersion ios: 4.6.25 android: 4.6.25
 */
export declare function batchDisplayNames$(params: IInternalChatBatchDisplayNamesParams): Promise<IInternalChatBatchDisplayNamesResult>;
export default batchDisplayNames$;
