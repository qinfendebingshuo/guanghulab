import { ICommonAPIParams } from '../../constant/types';
/**
 * 在新页面打开文档 请求参数定义
 * @apiName openDocument
 */
export interface IUnionOpenDocumentParams extends ICommonAPIParams {
    filePath: string;
    fileType?: string;
}
/**
 * 在新页面打开文档 返回结果定义
 * @apiName openDocument
 */
export interface IUnionOpenDocumentResult {
}
/**
 * 在新页面打开文档
 * @apiName openDocument
 */
export declare function openDocument$(params: IUnionOpenDocumentParams): Promise<IUnionOpenDocumentResult>;
export default openDocument$;
