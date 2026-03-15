import { ICommonAPIParams } from '../../constant/types';
/**
 * 创建企业群聊天。	 请求参数定义
 * @apiName createGroupChat
 */
export interface IUnionCreateGroupChatParams extends ICommonAPIParams {
}
/**
 * 创建企业群聊天。	 返回结果定义
 * @apiName createGroupChat
 */
export interface IUnionCreateGroupChatResult {
}
/**
 * 创建企业群聊天。
 * @apiName createGroupChat
 */
export declare function createGroupChat$(params: IUnionCreateGroupChatParams): Promise<IUnionCreateGroupChatResult>;
export default createGroupChat$;
