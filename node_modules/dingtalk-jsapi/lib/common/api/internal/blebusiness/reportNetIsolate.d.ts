export declare const apiName = "internal.blebusiness.reportNetIsolate";
/**
 * 上报网络隔离情况（F线） 请求参数定义
 * @apiName internal.blebusiness.reportNetIsolate
 */
export interface IInternalBlebusinessReportNetIsolateParams {
    /** 当前连接WIFI的SSID */
    ssid: string;
    /** 设备大类型 */
    devType: string;
    /** IP地址  */
    ip: string;
}
/**
 * 上报网络隔离情况（F线） 返回结果定义
 * @apiName internal.blebusiness.reportNetIsolate
 */
export interface IInternalBlebusinessReportNetIsolateResult {
}
/**
 * 上报网络隔离情况（F线）
 * @apiName internal.blebusiness.reportNetIsolate
 * @supportVersion ios: 4.6.18
 */
export declare function reportNetIsolate$(params: IInternalBlebusinessReportNetIsolateParams): Promise<IInternalBlebusinessReportNetIsolateResult>;
export default reportNetIsolate$;
