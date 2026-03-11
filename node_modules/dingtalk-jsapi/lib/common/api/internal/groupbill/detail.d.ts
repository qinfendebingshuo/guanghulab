export declare const apiName = "internal.groupbill.detail";
/**
 * 跳转钉钉群收款详情小程序页面 请求参数定义
 * @apiName internal.groupbill.detail
 */
export interface IInternalGroupbillDetailParams {
    /** 群收款创建者unionId */
    creatorUnionId: string;
    /** 订单号 */
    orderNo: string;
}
/**
 * 跳转钉钉群收款详情小程序页面 返回结果定义
 * @apiName internal.groupbill.detail
 */
export interface IInternalGroupbillDetailResult {
    [key: string]: any;
}
/**
 * 跳转钉钉群收款详情小程序页面
 * @apiName internal.groupbill.detail
 * @supportVersion ios: 5.1.6 android: 5.1.6
 * @author Android：峰砺 iOS：木锤
 */
export declare function detail$(params: IInternalGroupbillDetailParams): Promise<IInternalGroupbillDetailResult>;
export default detail$;
