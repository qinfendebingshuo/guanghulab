import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开本地文件 请求参数定义
 * @apiName openLocalFile
 */
export interface IUnionOpenLocalFileParams extends ICommonAPIParams {
    url: string;
}
/**
 * 打开本地文件 返回结果定义
 * @apiName openLocalFile
 */
export interface IUnionOpenLocalFileResult {
}
/**
 * 打开本地文件
 * @apiName openLocalFile
 */
export declare function openLocalFile$(params: IUnionOpenLocalFileParams): Promise<IUnionOpenLocalFileResult>;
export default openLocalFile$;
