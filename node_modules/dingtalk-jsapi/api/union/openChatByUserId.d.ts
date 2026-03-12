import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开与某个用户的聊天页面（单聊会话） 请求参数定义
 * @apiName openChatByUserId
 */
export interface IUnionOpenChatByUserIdParams extends ICommonAPIParams {
    corpId?: string;
    userId: string;
}
/**
 * 打开与某个用户的聊天页面（单聊会话） 返回结果定义
 * @apiName openChatByUserId
 */
export interface IUnionOpenChatByUserIdResult {
}
/**
 * 打开与某个用户的聊天页面（单聊会话）
 * @apiName openChatByUserId
 */
export declare function openChatByUserId$(params: IUnionOpenChatByUserIdParams): Promise<IUnionOpenChatByUserIdResult>;
export default openChatByUserId$;
