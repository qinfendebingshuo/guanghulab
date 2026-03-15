import { ICommonAPIParams } from '../../constant/types';
/**
 * 生成二维码 请求参数定义
 * @apiName generateImageFromCode
 */
export interface IUnionGenerateImageFromCodeParams extends ICommonAPIParams {
    code: string;
    width: number;
    format: string;
}
/**
 * 生成二维码 返回结果定义
 * @apiName generateImageFromCode
 */
export interface IUnionGenerateImageFromCodeResult {
    image: string;
}
/**
 * 生成二维码
 * @apiName generateImageFromCode
 */
export declare function generateImageFromCode$(params: IUnionGenerateImageFromCodeParams): Promise<IUnionGenerateImageFromCodeResult>;
export default generateImageFromCode$;
