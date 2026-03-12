import { ICommonAPIParams } from '../../constant/types';
/**
 * 替换页面 请求参数定义
 * @apiName replacePage
 */
export interface IUnionReplacePageParams extends ICommonAPIParams {
    url: string;
}
/**
 * 替换页面 返回结果定义
 * @apiName replacePage
 */
export interface IUnionReplacePageResult {
}
/**
 * 替换页面
 * @apiName replacePage
 */
export declare function replacePage$(params: IUnionReplacePageParams): Promise<IUnionReplacePageResult>;
export default replacePage$;
