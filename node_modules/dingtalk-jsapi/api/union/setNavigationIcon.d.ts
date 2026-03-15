import { ICommonAPIParams } from '../../constant/types';
/**
 * 标题栏添加问号图标 请求参数定义
 * @apiName setNavigationIcon
 */
export interface IUnionSetNavigationIconParams extends ICommonAPIParams {
    showIcon: boolean;
    iconIndex: number;
}
/**
 * 标题栏添加问号图标 返回结果定义
 * @apiName setNavigationIcon
 */
export interface IUnionSetNavigationIconResult {
}
/**
 * 标题栏添加问号图标
 * @apiName setNavigationIcon
 */
export declare function setNavigationIcon$(params: IUnionSetNavigationIconParams): Promise<IUnionSetNavigationIconResult>;
export default setNavigationIcon$;
