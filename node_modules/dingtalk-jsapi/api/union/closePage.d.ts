import { ICommonAPIParams } from '../../constant/types';
/**
 * 关闭当前页面 请求参数定义
 * @apiName closePage
 */
export interface IUnionClosePageParams extends ICommonAPIParams {
}
/**
 * 关闭当前页面 返回结果定义
 * @apiName closePage
 */
export interface IUnionClosePageResult {
}
/**
 * 关闭当前页面
 * @apiName closePage
 */
export declare function closePage$(params: IUnionClosePageParams): Promise<IUnionClosePageResult>;
export default closePage$;
