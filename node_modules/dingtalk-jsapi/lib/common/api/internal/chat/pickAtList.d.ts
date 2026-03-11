export declare const apiName = "internal.chat.pickAtList";
/**
 * @人弹出选人组件 请求参数定义
 * @apiName internal.chat.pickAtList
 */
export interface IInternalChatPickAtListParams {
    cid: string;
}
/**
 * @人弹出选人组件 返回结果定义
 * @apiName internal.chat.pickAtList
 * at人的列表，{"uid":"nick"}对象
 */
export interface IInternalChatPickAtListResult {
    [uid: string]: string;
}
/**
 * @人弹出选人组件
 * @apiName internal.chat.pickAtList
 * @supportVersion ios: 4.7.5 android: 4.7.5
 */
export declare function pickAtList$(params: IInternalChatPickAtListParams): Promise<IInternalChatPickAtListResult>;
export default pickAtList$;
