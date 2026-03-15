export declare const apiName = "internal.biz.webNotify";
/**
 * 通知容器前端页面事件，透传参数 请求参数定义
 * @apiName internal.biz.webNotify
 */
export interface IInternalBizWebNotifyParams {
    /** 容器类型 */
    type: string;
    /** 透传的json数据 */
    data: string;
}
/**
 * 通知容器前端页面事件，透传参数 返回结果定义
 * @apiName internal.biz.webNotify
 */
export interface IInternalBizWebNotifyResult {
}
/**
 * 通知容器前端页面事件，透传参数
 * @apiName internal.biz.webNotify
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function webNotify$(params: IInternalBizWebNotifyParams): Promise<IInternalBizWebNotifyResult>;
export default webNotify$;
