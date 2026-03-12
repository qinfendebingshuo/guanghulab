import { ICommonAPIParams } from '../../constant/types';
/**
 * 注册通知（流式返回） 请求参数定义
 * @apiName subscribe
 */
export interface IUnionSubscribeParams extends ICommonAPIParams {
    token: string;
    eventName: string;
    nameSpace: string;
}
/**
 * 注册通知（流式返回） 返回结果定义
 * @apiName subscribe
 */
export interface IUnionSubscribeResult {
}
/**
 * 注册通知（流式返回）
 * @apiName subscribe
 */
export declare function subscribe$(params: IUnionSubscribeParams): Promise<IUnionSubscribeResult>;
export default subscribe$;
