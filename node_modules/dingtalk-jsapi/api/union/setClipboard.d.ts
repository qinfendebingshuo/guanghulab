import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置剪切板数据 请求参数定义
 * @apiName setClipboard
 */
export interface IUnionSetClipboardParams extends ICommonAPIParams {
    text: string;
}
/**
 * 设置剪切板数据 返回结果定义
 * @apiName setClipboard
 */
export interface IUnionSetClipboardResult {
}
/**
 * 设置剪切板数据
 * @apiName setClipboard
 */
export declare function setClipboard$(params: IUnionSetClipboardParams): Promise<IUnionSetClipboardResult>;
export default setClipboard$;
