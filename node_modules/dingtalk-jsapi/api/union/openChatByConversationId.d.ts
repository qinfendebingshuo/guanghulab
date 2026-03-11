import { ICommonAPIParams } from '../../constant/types';
/**
 * 根据openConversationId跳转到对应会话 请求参数定义
 * @apiName openChatByConversationId
 */
export interface IUnionOpenChatByConversationIdParams extends ICommonAPIParams {
    openConversationId: string;
}
/**
 * 根据openConversationId跳转到对应会话 返回结果定义
 * @apiName openChatByConversationId
 */
export interface IUnionOpenChatByConversationIdResult {
}
/**
 * 根据openConversationId跳转到对应会话
 * @apiName openChatByConversationId
 */
export declare function openChatByConversationId$(params: IUnionOpenChatByConversationIdParams): Promise<IUnionOpenChatByConversationIdResult>;
export default openChatByConversationId$;
