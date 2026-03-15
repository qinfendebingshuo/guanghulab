export declare const apiName = "internal.chat.getConvInfo";
/**
 * 获取指定会话信息 请求参数定义
 * @apiName internal.chat.getConvInfo
 */
export interface IInternalChatGetConvInfoParams {
    cid: string;
}
/**
 * 获取指定会话信息 返回结果定义
 * @apiName internal.chat.getConvInfo
 */
export interface IInternalChatGetConvInfoResult {
    chatLabelType: number;
    type: number;
    companyGroupInfo?: {
        orgId: string;
        orgName: string;
    };
    tag?: string;
}
/**
 * 获取指定会话信息
 * @apiName internal.chat.getConvInfo
 * @supportVersion pc: 4.6.42
 */
export declare function getConvInfo$(params: IInternalChatGetConvInfoParams): Promise<IInternalChatGetConvInfoResult>;
export default getConvInfo$;
