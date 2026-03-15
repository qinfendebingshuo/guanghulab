import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开目标页面 请求参数定义
 * @apiName openLink
 */
export interface IUnionOpenLinkParams extends ICommonAPIParams {
    url: string;
}
/**
 * 打开目标页面 返回结果定义
 * @apiName openLink
 */
export interface IUnionOpenLinkResult {
}
/**
 * 打开目标页面
 * @apiName openLink
 */
export declare function openLink$(params: IUnionOpenLinkParams): Promise<IUnionOpenLinkResult>;
export default openLink$;
