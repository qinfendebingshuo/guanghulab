import { ICommonAPIParams } from '../../constant/types';
/**
 * 媒体选择 请求参数定义
 * @apiName chooseMedia
 */
export interface IUnionChooseMediaParams extends ICommonAPIParams {
    count: number;
    camera: string;
    sizeType: string;
    mediaType: string;
    sourceType: string[];
    maxDuration: number;
}
/**
 * 媒体选择 返回结果定义
 * @apiName chooseMedia
 */
export interface IUnionChooseMediaResult {
    tempFiles: {
        size: number;
        width: number;
        height: number;
        duration: number;
        fileType: string;
        tempFilePath: string;
    }[];
}
/**
 * 媒体选择
 * @apiName chooseMedia
 */
export declare function chooseMedia$(params: IUnionChooseMediaParams): Promise<IUnionChooseMediaResult>;
export default chooseMedia$;
