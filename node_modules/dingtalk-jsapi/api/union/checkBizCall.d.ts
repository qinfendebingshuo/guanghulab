import { ICommonAPIParams } from '../../constant/types';
/**
 * 检查某企业办公电话开通状态 请求参数定义
 * @apiName checkBizCall
 */
export interface IUnionCheckBizCallParams extends ICommonAPIParams {
    corpId: string;
}
/**
 * 检查某企业办公电话开通状态 返回结果定义
 * @apiName checkBizCall
 */
export interface IUnionCheckBizCallResult {
    isSupport: boolean;
}
/**
 * 检查某企业办公电话开通状态
 * @apiName checkBizCall
 */
export declare function checkBizCall$(params: IUnionCheckBizCallParams): Promise<IUnionCheckBizCallResult>;
export default checkBizCall$;
