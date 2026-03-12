import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择会话 请求参数定义
 * @apiName chooseConversation
 */
export interface IUnionChooseConversationParams extends ICommonAPIParams {
    max: number;
    multiple?: boolean;
    isConfirm?: boolean;
    newPickMode?: boolean;
    pickedConvList?: string[];
}
/**
 * 选择会话 返回结果定义
 * @apiName chooseConversation
 */
export interface IUnionChooseConversationResult {
    id: string;
    title: string;
    isEnterpriseGroup: boolean;
}
/**
 * 选择会话
 * @apiName chooseConversation
 */
export declare function chooseConversation$(params: IUnionChooseConversationParams): Promise<IUnionChooseConversationResult>;
export default chooseConversation$;
