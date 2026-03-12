import { ICommonAPIParams } from '../../constant/types';
/**
 * 编辑图片 请求参数定义
 * @apiName editPicture
 */
export interface IUnionEditPictureParams extends ICommonAPIParams {
    url: string;
}
/**
 * 编辑图片 返回结果定义
 * @apiName editPicture
 */
export interface IUnionEditPictureResult {
}
/**
 * 编辑图片
 * @apiName editPicture
 */
export declare function editPicture$(params: IUnionEditPictureParams): Promise<IUnionEditPictureResult>;
export default editPicture$;
