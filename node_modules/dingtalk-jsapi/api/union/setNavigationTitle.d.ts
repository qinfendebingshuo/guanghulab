import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置导航栏标题 请求参数定义
 * @apiName setNavigationTitle
 */
export interface IUnionSetNavigationTitleParams extends ICommonAPIParams {
    title: string;
}
/**
 * 设置导航栏标题 返回结果定义
 * @apiName setNavigationTitle
 */
export interface IUnionSetNavigationTitleResult {
}
/**
 * 设置导航栏标题
 * @apiName setNavigationTitle
 */
export declare function setNavigationTitle$(params: IUnionSetNavigationTitleParams): Promise<IUnionSetNavigationTitleResult>;
export default setNavigationTitle$;
