import { ICommonAPIParams } from '../../constant/types';
/**
 * 跳转H5微应用 请求参数定义
 * @apiName navigateToPage
 */
export interface IUnionNavigateToPageParams extends ICommonAPIParams {
    url: string;
}
/**
 * 跳转H5微应用 返回结果定义
 * @apiName navigateToPage
 */
export interface IUnionNavigateToPageResult {
}
/**
 * 跳转H5微应用
 * @apiName navigateToPage
 */
export declare function navigateToPage$(params: IUnionNavigateToPageParams): Promise<IUnionNavigateToPageResult>;
export default navigateToPage$;
