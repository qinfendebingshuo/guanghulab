export declare const apiName = "internal.groupbill.query";
/**
 * 查询群收款是否存在 请求参数定义
 * @apiName internal.groupbill.query
 */
export interface IInternalGroupbillQueryParams {
    /** 群收款创建者unionId */
    creatorUnionId: string;
    /** 订单号 */
    orderNo: string;
}
/**
 * 查询群收款是否存在 返回结果定义
 * @apiName internal.groupbill.query
 */
export interface IInternalGroupbillQueryResult {
    /** 0:不存在 1：已存在 */
    exist: number;
}
/**
 * 查询群收款是否存在
 * @apiName internal.groupbill.query
 * @supportVersion ios: 5.1.6 android: 5.1.6
 * @author Android：峰砺 iOS：木锤
 */
export declare function query$(params: IInternalGroupbillQueryParams): Promise<IInternalGroupbillQueryResult>;
export default query$;
