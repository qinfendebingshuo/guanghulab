import { ICommonAPIParams } from '../../constant/types';
/**
 * 发起办公电话呼叫 请求参数定义
 * @apiName makeCloudCall
 */
export interface IUnionMakeCloudCallParams extends ICommonAPIParams {
    corpId: string;
    bizNumber: string;
    calleeNumber: string;
    openCallRecord?: boolean;
    hideCalleeNumber?: boolean;
    closePushCallRecord?: boolean;
}
/**
 * 发起办公电话呼叫 返回结果定义
 * @apiName makeCloudCall
 */
export interface IUnionMakeCloudCallResult {
    code: number;
    cause: string;
    sessionId: string;
}
/**
 * 发起办公电话呼叫
 * @apiName makeCloudCall
 */
export declare function makeCloudCall$(params: IUnionMakeCloudCallParams): Promise<IUnionMakeCloudCallResult>;
export default makeCloudCall$;
