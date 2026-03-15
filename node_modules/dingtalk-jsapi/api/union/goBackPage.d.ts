import { ICommonAPIParams } from '../../constant/types';
/**
 * 返回上一级页面 请求参数定义
 * @apiName goBackPage
 */
export interface IUnionGoBackPageParams extends ICommonAPIParams {
}
/**
 * 返回上一级页面 返回结果定义
 * @apiName goBackPage
 */
export interface IUnionGoBackPageResult {
}
/**
 * 返回上一级页面
 * @apiName goBackPage
 */
export declare function goBackPage$(params: IUnionGoBackPageParams): Promise<IUnionGoBackPageResult>;
export default goBackPage$;
