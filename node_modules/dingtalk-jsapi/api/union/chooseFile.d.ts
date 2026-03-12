import { ICommonAPIParams } from '../../constant/types';
/**
 * 文件选择 请求参数定义
 * @apiName chooseFile
 */
export interface IUnionChooseFileParams extends ICommonAPIParams {
    count: number;
    multiSelection: boolean;
}
/**
 * 文件选择 返回结果定义
 * @apiName chooseFile
 */
export interface IUnionChooseFileResult {
    files: {
        name: string;
        path: string;
        size: number;
    };
}
/**
 * 文件选择
 * @apiName chooseFile
 */
export declare function chooseFile$(params: IUnionChooseFileParams): Promise<IUnionChooseFileResult>;
export default chooseFile$;
