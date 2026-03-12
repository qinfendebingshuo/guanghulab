import { ICommonAPIParams } from '../../constant/types';
/**
 * 根据chatId跳转到对应会话 请求参数定义
 * @apiName openChatByChatId
 */
export interface IUnionOpenChatByChatIdParams extends ICommonAPIParams {
    chatId: string;
    corpId?: string;
}
/**
 * 根据chatId跳转到对应会话 返回结果定义
 * @apiName openChatByChatId
 */
export interface IUnionOpenChatByChatIdResult {
}
/**
 * 根据chatId跳转到对应会话
 * @apiName openChatByChatId
 */
export declare function openChatByChatId$(params: IUnionOpenChatByChatIdParams): Promise<IUnionOpenChatByChatIdResult>;
export default openChatByChatId$;
