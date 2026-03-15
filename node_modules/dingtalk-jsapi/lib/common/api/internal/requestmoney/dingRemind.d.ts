export declare const apiName = "internal.requestmoney.dingRemind";
/**
 * 收款详情页DING一下 请求参数定义
 * @apiName internal.requestmoney.dingRemind
 */
export interface IInternalRequestmoneyDingRemindParams {
    /** 提醒类型，1 应用内，2 短信，3 电话 */
    remindType: number;
    /** 接收人列表 */
    receiverUIds: number[];
    /** 收款发起人 */
    creatorUid: number;
    /** 收款id */
    groupBillId: string;
    /** 收款名称 */
    groupBillName: string;
    /** 收款账单，jsonstring，"[{"uid":12345,"amount":"12.34"},{"uid":67890,"amount":"43.21"}]" */
    bill: string;
}
/**
 * 收款详情页DING一下 返回结果定义  无需返回结果
 * @apiName internal.requestmoney.dingRemind
 */
export interface IInternalRequestmoneyDingRemindResult {
}
/**
 * 收款详情页DING一下
 * @apiName internal.requestmoney.dingRemind
 * @supportVersion ios: 4.5.6 android: 4.5.6
 */
export declare function dingRemind$(params: IInternalRequestmoneyDingRemindParams): Promise<IInternalRequestmoneyDingRemindResult>;
export default dingRemind$;
