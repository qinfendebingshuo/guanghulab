import { ICommonAPIParams } from '../../constant/types';
/**
 * 创建因公场景支付宝订单 请求参数定义
 * @apiName createPayOrder
 */
export interface IUnionCreatePayOrderParams extends ICommonAPIParams {
    bizScene: string;
    corpId: string;
    processInstanceId: string;
    journeyBizNo: string;
    orderList: {
        outBizNo: string;
        merchantId: string;
        amount: string;
        title: string;
        goodsName: string;
        remark: string;
    }[];
    controlStandard: string;
}
/**
 * 创建因公场景支付宝订单 返回结果定义
 * @apiName createPayOrder
 */
export interface IUnionCreatePayOrderResult {
    code: string;
    reason: string;
    reasonRemark: string;
    orderResultList: {
        outBizNo: string;
        enterprise_pay_info: string;
        assignJointAccountId: string;
        enterprisePayAmount: string;
    }[];
}
/**
 * 创建因公场景支付宝订单
 * @apiName createPayOrder
 */
export declare function createPayOrder$(params: IUnionCreatePayOrderParams): Promise<IUnionCreatePayOrderResult>;
export default createPayOrder$;
