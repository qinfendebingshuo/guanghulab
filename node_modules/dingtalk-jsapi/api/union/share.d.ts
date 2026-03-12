import { ICommonAPIParams } from '../../constant/types';
/**
 * 分享 请求参数定义
 * @apiName share
 */
export interface IUnionShareParams extends ICommonAPIParams {
    url?: string;
    type: number;
    image?: string;
    title: string;
    content?: string;
}
/**
 * 分享 返回结果定义
 * @apiName share
 */
export interface IUnionShareResult {
}
/**
 * 分享
 * @apiName share
 */
export declare function share$(params: IUnionShareParams): Promise<IUnionShareResult>;
export default share$;
