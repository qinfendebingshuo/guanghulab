import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择会话 请求参数定义
 * @apiName chooseChat
 */
export interface IUnionChooseChatParams extends ICommonAPIParams {
    corpId: string;
    isAllowCreateGroup: boolean;
    filterNotOwnerGroup: boolean;
}
/**
 * 选择会话 返回结果定义
 * @apiName chooseChat
 */
export interface IUnionChooseChatResult {
    title: string;
    chatId: string;
}
/**
 * 选择会话
 * @apiName chooseChat
 */
export declare function chooseChat$(params: IUnionChooseChatParams): Promise<IUnionChooseChatResult>;
export default chooseChat$;
