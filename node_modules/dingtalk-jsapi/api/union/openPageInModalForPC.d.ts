import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开模态框 请求参数定义
 * @apiName openPageInModalForPC
 */
export interface IUnionOpenPageInModalForPCParams extends ICommonAPIParams {
    url: string;
    size?: string;
    title: string;
}
/**
 * 打开模态框 返回结果定义
 * @apiName openPageInModalForPC
 */
export interface IUnionOpenPageInModalForPCResult {
}
/**
 * 打开模态框
 * @apiName openPageInModalForPC
 */
export declare function openPageInModalForPC$(params: IUnionOpenPageInModalForPCParams): Promise<IUnionOpenPageInModalForPCResult>;
export default openPageInModalForPC$;
