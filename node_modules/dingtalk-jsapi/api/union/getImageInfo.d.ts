import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取图片信息 请求参数定义
 * @apiName getImageInfo
 */
export interface IUnionGetImageInfoParams extends ICommonAPIParams {
    src: string;
}
/**
 * 获取图片信息 返回结果定义
 * @apiName getImageInfo
 */
export interface IUnionGetImageInfoResult {
    path: string;
    width: number;
    height: number;
}
/**
 * 获取图片信息
 * @apiName getImageInfo
 */
export declare function getImageInfo$(params: IUnionGetImageInfoParams): Promise<IUnionGetImageInfoResult>;
export default getImageInfo$;
