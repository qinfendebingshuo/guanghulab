import { ICommonAPIParams } from '../../constant/types';
/**
 * 群收款发起提交订单 请求参数定义
 * @apiName requestMoneySubmmitOrder
 */
export interface IUnionRequestMoneySubmmitOrderParams extends ICommonAPIParams {
    orderNo: string;
}
/**
 * 群收款发起提交订单 返回结果定义
 * @apiName requestMoneySubmmitOrder
 */
export interface IUnionRequestMoneySubmmitOrderResult {
}
/**
 * 群收款发起提交订单
 * @apiName requestMoneySubmmitOrder
 */
export declare function requestMoneySubmmitOrder$(params: IUnionRequestMoneySubmmitOrderParams): Promise<IUnionRequestMoneySubmmitOrderResult>;
export default requestMoneySubmmitOrder$;
