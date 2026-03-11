import { ICommonAPIParams } from '../../constant/types';
/**
 * 选择图片 请求参数定义
 * @apiName chooseImage
 */
export interface IUnionChooseImageParams extends ICommonAPIParams {
    count?: number;
    secret?: boolean;
    position?: string[];
    sourceType?: string[];
}
/**
 * 选择图片 返回结果定义
 * @apiName chooseImage
 */
export interface IUnionChooseImageResult {
    files: {
        path: string;
        size: number;
        fileType: string;
    }[];
    filePaths?: string[];
}
/**
 * 选择图片
 * @apiName chooseImage
 */
export declare function chooseImage$(params: IUnionChooseImageParams): Promise<IUnionChooseImageResult>;
export default chooseImage$;
